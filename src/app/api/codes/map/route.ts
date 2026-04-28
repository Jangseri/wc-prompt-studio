import { NextResponse } from 'next/server'
import { getPool, sanitizeDbError } from '@/lib/db'
import { logRoute } from '@/lib/logger'
import type { ApiResponse } from '@/types/editor'

export const dynamic = 'force-dynamic'

export async function GET() {
  return logRoute('[codes:map] GET', {}, async () => {
    try {
      const pool = getPool()
      const [rows] = await pool.execute('SELECT code, name_ko FROM code WHERE name_ko IS NOT NULL')
      const map: Record<string, string> = {}
      for (const row of rows as { code: string; name_ko: string }[]) {
        map[row.code] = row.name_ko
      }
      return NextResponse.json({ success: true, data: map } satisfies ApiResponse<Record<string, string>>)
    } catch (err) {
      return NextResponse.json(
        { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
        { status: 500 }
      )
    }
  })
}
