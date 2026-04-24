import type { PoolConnection } from "mysql2/promise";
import {
  resolveChannelCode,
  SIBLING_PRMT_CDS,
  type Channel,
  type SiblingPrmtCd,
} from "./prompt-codes";
import { SIBLING_DEFAULTS } from "./sibling-defaults";

/**
 * Applies a unified-workspace prompt to cstm_prmt_info atomically, under
 * a strict "create-new-only" policy:
 *
 *   - Pre-checks that NONE of the 4 target rows (main + 3 siblings) exist
 *     for the given (company_seq, ai_staff_seq, svc_cd, prmt_cd) keys.
 *   - If any exist, throws `ExistingPromptsError` and rolls back. No
 *     upsert, no update, no partial writes.
 *   - Otherwise, inserts all 4 rows fresh and commits.
 *
 * Editing an already-applied (company, staff) pair must go through the
 * dedicated management flow that targets individual cstm_id records.
 *
 * Race condition safety: two concurrent calls can both pass the pre-check
 * and attempt INSERTs. The UNIQUE constraint on
 * (company_seq, ai_staff_seq, svc_cd, prmt_cd) makes the second one
 * fail with ER_DUP_ENTRY; we catch that and convert it to
 * `ExistingPromptsError` so callers see a uniform result.
 *
 * See docs/unified-workspace-plan.md §6.2, §6B.1, §6B.2.
 */

export interface ApplyPromptInput {
  companySeq: string;
  aiStaffSeq: string;
  channel: Channel;
  /**
   * Industry string from the Source step. Certain industries
   * (currently "병원" on callbot) map to a different svc_cd — see
   * INDUSTRY_SVC_CD_OVERRIDES in prompt-codes.ts.
   */
  industry: string;
  /** Already-serialized main prompt string. */
  prompt: string;
  /**
   * Explicit override for the main record's json_schema column. If omitted,
   * the resolved ChannelCode.json_schema is used (null for callbot, the
   * double_response_list default for chatbot).
   */
  jsonSchemaOverride?: string | null;
}

export interface ApplySiblingResult {
  prmt_cd: SiblingPrmtCd;
  cstm_id: number;
  /**
   * Always true under the create-new-only policy — kept for backward
   * compatibility with response consumers that previously distinguished
   * created vs. skipped siblings.
   */
  created: true;
}

export interface ApplyPromptResult {
  main: {
    svc_cd: string;
    prmt_cd: string;
    cstm_id: number;
  };
  siblings: ApplySiblingResult[];
}

/** Thrown when the pre-check finds existing rows, or when a concurrent
 *  insert races past the pre-check and hits the UNIQUE constraint. */
export class ExistingPromptsError extends Error {
  constructor(public readonly existingPrmtCds: string[]) {
    const list =
      existingPrmtCds.length > 0 ? existingPrmtCds.join(", ") : "(동시 저장 감지)";
    super(`기존 프롬프트가 이미 존재합니다: ${list}`);
    this.name = "ExistingPromptsError";
  }
}

interface OkPacket {
  insertId: number;
  affectedRows: number;
}

interface MainLookupRow {
  cstm_id: number;
}

interface ExistingPrmtRow {
  prmt_cd: string;
}

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: string }).code;
  const errno = (err as { errno?: number }).errno;
  return code === "ER_DUP_ENTRY" || errno === 1062;
}

const CHECK_EXISTING_SQL = `
  SELECT prmt_cd FROM cstm_prmt_info
  WHERE company_seq = ?
    AND ai_staff_seq = ?
    AND svc_cd = ?
    AND prmt_cd IN (?, ?, ?, ?)
`;

const INSERT_SQL = `
  INSERT INTO cstm_prmt_info
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
  const { svc_cd, prmt_cd, json_schema } = resolveChannelCode(
    input.channel,
    input.industry
  );
  const mainJsonSchema =
    input.jsonSchemaOverride !== undefined ? input.jsonSchemaOverride : json_schema;

  await conn.beginTransaction();

  try {
    // Pre-check: no existing rows for any of the 4 target prmt_cds.
    const [existingResult] = await conn.execute(CHECK_EXISTING_SQL, [
      input.companySeq,
      input.aiStaffSeq,
      svc_cd,
      prmt_cd,
      ...SIBLING_PRMT_CDS,
    ]);
    const existingRows = existingResult as unknown as ExistingPrmtRow[];
    if (existingRows.length > 0) {
      throw new ExistingPromptsError(existingRows.map((r) => r.prmt_cd));
    }

    // Plain INSERT for main. Duplicate-key errors (from a concurrent
    // insert) are converted to ExistingPromptsError in the catch block.
    await conn.execute(INSERT_SQL, [
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
      const [res] = await conn.execute(INSERT_SQL, [
        input.companySeq,
        input.aiStaffSeq,
        svc_cd,
        sibPrmt,
        def.prompt,
        def.json_schema,
      ]);
      const packet = res as unknown as OkPacket;
      siblings.push({
        prmt_cd: sibPrmt,
        cstm_id: packet.insertId,
        created: true,
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
        "applyPromptTransaction: main row lookup returned no result after insert"
      );
    }

    await conn.commit();

    return {
      main: { svc_cd, prmt_cd, cstm_id: mainCstmId },
      siblings,
    };
  } catch (err) {
    await conn.rollback();
    if (err instanceof ExistingPromptsError) throw err;
    if (isDuplicateKeyError(err)) {
      throw new ExistingPromptsError([]);
    }
    throw err;
  }
}
