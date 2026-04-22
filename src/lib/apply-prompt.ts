import type { PoolConnection } from "mysql2/promise";
import {
  CHANNEL_CODES,
  SIBLING_PRMT_CDS,
  type Channel,
  type SiblingPrmtCd,
} from "./prompt-codes";
import { SIBLING_DEFAULTS } from "./sibling-defaults";

/**
 * Applies a unified-workspace prompt to cstm_prmt_info atomically.
 *
 *  1. Main (PD2000 callbot / PD0000 chatbot) — upsert with
 *     ON DUPLICATE KEY UPDATE so re-applying overwrites prompt + json_schema
 *     and flips status to 'Y' + updt_dt to NOW().
 *  2. Siblings (PA4000 / PA1000 / PC1000) — INSERT IGNORE so existing tuning
 *     is preserved.
 *
 * Wraps everything in BEGIN / COMMIT. Any thrown error triggers rollback.
 *
 * The connection is taken as an argument so tests can mock it and the caller
 * controls connection lifecycle (pool.getConnection + release outside this
 * function).
 *
 * See docs/unified-workspace-plan.md §6.2, §6B.1, §6B.2.
 */

export interface ApplyPromptInput {
  companySeq: string;
  aiStaffSeq: string;
  channel: Channel;
  /** Already-serialized main prompt string. */
  prompt: string;
  /**
   * Explicit override for the main record's json_schema column. If omitted,
   * CHANNEL_CODES[channel].json_schema is used (null for callbot, the
   * double_response_list default for chatbot).
   */
  jsonSchemaOverride?: string | null;
}

export interface ApplySiblingResult {
  prmt_cd: SiblingPrmtCd;
  cstm_id: number | null;
  /** True if this INSERT IGNORE actually created a row this call. */
  created: boolean;
}

export interface ApplyPromptResult {
  main: {
    svc_cd: string;
    prmt_cd: string;
    cstm_id: number;
  };
  siblings: ApplySiblingResult[];
}

interface OkPacket {
  insertId: number;
  affectedRows: number;
}

interface MainLookupRow {
  cstm_id: number;
}

const INSERT_MAIN_SQL = `
  INSERT INTO cstm_prmt_info
    (company_seq, ai_staff_seq, svc_cd, prmt_cd, status, prompt, json_schema, rgst_dt, updt_dt)
  VALUES (?, ?, ?, ?, 'Y', ?, ?, NOW(), NOW())
  ON DUPLICATE KEY UPDATE
    prompt = VALUES(prompt),
    json_schema = VALUES(json_schema),
    status = 'Y',
    updt_dt = NOW()
`;

const INSERT_SIBLING_SQL = `
  INSERT IGNORE INTO cstm_prmt_info
    (company_seq, ai_staff_seq, svc_cd, prmt_cd, status, prompt, json_schema, rgst_dt, updt_dt)
  VALUES (?, ?, ?, ?, 'Y', ?, ?, NOW(), NOW())
`;

const LOOKUP_MAIN_SQL = `
  SELECT cstm_id FROM cstm_prmt_info
  WHERE company_seq = ? AND ai_staff_seq = ? AND svc_cd = ? AND prmt_cd = ?
`;

export async function applyPromptTransaction(
  conn: PoolConnection,
  input: ApplyPromptInput
): Promise<ApplyPromptResult> {
  const { svc_cd, prmt_cd, json_schema } = CHANNEL_CODES[input.channel];
  const mainJsonSchema =
    input.jsonSchemaOverride !== undefined ? input.jsonSchemaOverride : json_schema;

  await conn.beginTransaction();

  try {
    await conn.execute(INSERT_MAIN_SQL, [
      input.companySeq,
      input.aiStaffSeq,
      svc_cd,
      prmt_cd,
      input.prompt,
      mainJsonSchema,
    ]);

    const siblings: ApplySiblingResult[] = [];

    for (const sibPrmt of SIBLING_PRMT_CDS) {
      const def = SIBLING_DEFAULTS[sibPrmt];
      const [res] = await conn.execute(INSERT_SIBLING_SQL, [
        input.companySeq,
        input.aiStaffSeq,
        svc_cd,
        sibPrmt,
        def.prompt,
        def.json_schema,
      ]);
      const packet = res as unknown as OkPacket;
      const created = (packet?.affectedRows ?? 0) === 1;
      siblings.push({
        prmt_cd: sibPrmt,
        cstm_id: created ? packet.insertId : null,
        created,
      });
    }

    const [lookupRows] = await conn.execute(LOOKUP_MAIN_SQL, [
      input.companySeq,
      input.aiStaffSeq,
      svc_cd,
      prmt_cd,
    ]);
    const rows = lookupRows as unknown as MainLookupRow[];
    const mainCstmId = rows[0]?.cstm_id;
    if (mainCstmId == null) {
      throw new Error(
        "applyPromptTransaction: main row lookup returned no result after upsert"
      );
    }

    await conn.commit();

    return {
      main: { svc_cd, prmt_cd, cstm_id: mainCstmId },
      siblings,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}
