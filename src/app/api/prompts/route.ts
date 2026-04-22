import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getPool, sanitizeDbError } from "@/lib/db";
import { applyPromptTransaction } from "@/lib/apply-prompt";
import {
  promptsPostSchema,
  isChannelPromptsPost,
} from "@/lib/schemas/prompts";
import { check as rateCheck, getClientIp } from "@/lib/rate-limit";
import type { ApiResponse, CstmPrmtInfo } from "@/types/editor";

const RATE_LIMIT = { capacity: 30, refillPerSecond: 30 / 60 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companySeq = searchParams.get("company_seq");
  const aiStaffSeq = searchParams.get("ai_staff_seq");
  const svcCd = searchParams.get("svc_cd");

  try {
    const pool = getPool();
    const conditions: string[] = [];
    const params: string[] = [];

    if (companySeq) {
      conditions.push("company_seq = ?");
      params.push(companySeq);
    }
    if (aiStaffSeq) {
      conditions.push("ai_staff_seq = ?");
      params.push(aiStaffSeq);
    }
    if (svcCd) {
      conditions.push("svc_cd = ?");
      params.push(svcCd);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.execute<CstmPrmtInfo[] & import("mysql2").RowDataPacket[]>(
      `SELECT * FROM cstm_prmt_info ${where} ORDER BY updt_dt DESC`,
      params
    );

    return NextResponse.json({ success: true, data: rows } satisfies ApiResponse<CstmPrmtInfo[]>);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateCheck(ip, RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요." } satisfies ApiResponse<null>,
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil(rl.resetMs / 1000)) },
      }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "잘못된 요청 형식입니다" } satisfies ApiResponse<null>,
      { status: 400 }
    );
  }

  let parsed;
  try {
    parsed = promptsPostSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "요청 스키마 검증 실패",
          details: err.flatten(),
        } as ApiResponse<null> & { details: unknown },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "요청 검증 실패" } satisfies ApiResponse<null>,
      { status: 400 }
    );
  }

  if (isChannelPromptsPost(parsed)) {
    // New path: 4-record transaction via applyPromptTransaction
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      const result = await applyPromptTransaction(conn, {
        companySeq: parsed.company_seq,
        aiStaffSeq: parsed.ai_staff_seq,
        channel: parsed.channel,
        prompt: parsed.prompt,
        jsonSchemaOverride:
          parsed.json_schema === undefined ? undefined : parsed.json_schema,
      });

      // Hydrate the main record for the response body
      const [rows] = await conn.execute(
        "SELECT * FROM cstm_prmt_info WHERE cstm_id = ?",
        [result.main.cstm_id]
      );
      const main = (rows as CstmPrmtInfo[])[0];

      return NextResponse.json(
        {
          success: true,
          data: {
            main,
            siblings: result.siblings,
          },
        } as ApiResponse<{
          main: CstmPrmtInfo;
          siblings: typeof result.siblings;
        }>,
        { status: 201 }
      );
    } catch (err) {
      return NextResponse.json(
        { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
        { status: 500 }
      );
    } finally {
      conn.release();
    }
  }

  // Legacy path: single-record insert (kept for backward compatibility)
  try {
    const pool = getPool();
    const [result] = await pool.execute({
      sql: `INSERT INTO cstm_prmt_info (company_seq, ai_staff_seq, svc_cd, prmt_cd, status, prompt, json_schema, rgst_dt, updt_dt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      values: [
        parsed.company_seq,
        parsed.ai_staff_seq,
        parsed.svc_cd,
        parsed.prmt_cd,
        parsed.status ?? "Y",
        parsed.prompt,
        parsed.json_schema ?? null,
      ],
    });

    const insertId = (result as { insertId: number }).insertId;
    const [rows] = await pool.execute(
      "SELECT * FROM cstm_prmt_info WHERE cstm_id = ?",
      [insertId]
    );
    const inserted = (rows as CstmPrmtInfo[])[0];

    return NextResponse.json(
      { success: true, data: inserted } satisfies ApiResponse<CstmPrmtInfo>,
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
}
