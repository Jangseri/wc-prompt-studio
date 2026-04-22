import { NextResponse } from 'next/server'
import { getPool, sanitizeDbError } from '@/lib/db'
import type { ApiResponse, Code } from '@/types/editor'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const upCode = searchParams.get('up_code')

  if (!upCode || !upCode.trim()) {
    return NextResponse.json(
      { success: false, error: 'up_code parameter is required' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  try {
    const pool = getPool()
    const [rows] = await pool.execute<Code[] & import('mysql2').RowDataPacket[]>(
      'SELECT code, up_code, name_ko, name_en, status FROM code WHERE up_code = ? ORDER BY code',
      [upCode]
    )
    return NextResponse.json({ success: true, data: rows } satisfies ApiResponse<Code[]>)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
      { status: 500 }
    )
  }
}
