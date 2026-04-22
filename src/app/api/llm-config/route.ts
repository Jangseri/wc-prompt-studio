import { NextResponse } from 'next/server'
import { getPool, sanitizeDbError } from '@/lib/db'
import type { ApiResponse } from '@/types/editor'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      "SELECT svc_cd, prmt_cd, llm_model_tp FROM orc_llm_conf WHERE status = 'Y'"
    )
    const map: Record<string, string> = {}
    for (const row of rows as { svc_cd: string; prmt_cd: string; llm_model_tp: string }[]) {
      map[`${row.svc_cd}|${row.prmt_cd}`] = row.llm_model_tp
    }
    return NextResponse.json({ success: true, data: map } satisfies ApiResponse<Record<string, string>>)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
      { status: 500 }
    )
  }
}
