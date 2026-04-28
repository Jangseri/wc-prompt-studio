import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool, sanitizeDbError } from "@/lib/db";
import { logRoute } from "@/lib/logger";
import { parseCompaniesQuery } from "@/lib/schemas/companies";
import type { ApiResponse } from "@/types/editor";
import { CHANNEL_CODES, type Channel } from "@/lib/prompt-codes";
import { ZodError } from "zod";

export interface CompanyRow {
  company_seq: string;
  ai_staff_seq: string;
  svc_cd: string;
  prmt_cd: string;
  status: "Y" | "N";
  updt_dt: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return logRoute("[companies] GET", {}, async () => {
  let parsed;
  try {
    parsed = parseCompaniesQuery(searchParams);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "쿼리 파라미터 검증 실패",
          details: err.flatten(),
        } as ApiResponse<null> & { details: unknown },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "쿼리 파라미터가 올바르지 않습니다" } satisfies ApiResponse<null>,
      { status: 400 }
    );
  }

  try {
    const conditions: string[] = [];
    const params: string[] = [];

    // Default: only status='Y' unless explicitly overridden
    if (parsed.status) {
      conditions.push("status = ?");
      params.push(parsed.status);
    } else {
      conditions.push("status = ?");
      params.push("Y");
    }

    if (parsed.company_seq) {
      conditions.push("company_seq = ?");
      params.push(parsed.company_seq);
    }
    if (parsed.ai_staff_seq) {
      conditions.push("ai_staff_seq = ?");
      params.push(parsed.ai_staff_seq);
    }
    if (parsed.channel) {
      conditions.push("svc_cd = ?");
      params.push(CHANNEL_CODES[parsed.channel as Channel].svc_cd);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const pool = getPool();
    const [rows] = await pool.execute<CompanyRow[] & RowDataPacket[]>(
      `SELECT company_seq, ai_staff_seq, svc_cd, prmt_cd, status, updt_dt
       FROM cstm_prmt_info
       ${where}
       ORDER BY updt_dt DESC`,
      params
    );

    return NextResponse.json(
      { success: true, data: rows } satisfies ApiResponse<CompanyRow[]>
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
  });
}
