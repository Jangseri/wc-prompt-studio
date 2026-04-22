import { NextResponse } from 'next/server'
import { getPool, sanitizeDbError } from '@/lib/db'
import type { ApiResponse, Code } from '@/types/editor'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const prefix = searchParams.get('prefix')

  if (!prefix || !['S', 'P'].includes(prefix)) {
    return NextResponse.json(
      { success: false, error: 'prefix parameter must be "S" or "P"' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  try {
    const pool = getPool()
    const [rows] = await pool.execute<Partial<Code>[] & import('mysql2').RowDataPacket[]>(
      'SELECT code, up_code, name_ko FROM code WHERE code LIKE ? AND status = ? ORDER BY code',
      [`${prefix}%`, 'Y']
    )
    return NextResponse.json({ success: true, data: rows } satisfies ApiResponse<Partial<Code>[]>)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
      { status: 500 }
    )
  }
}
