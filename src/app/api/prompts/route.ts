import { NextResponse } from 'next/server'
import { getPool, sanitizeDbError } from '@/lib/db'
import type { ApiResponse, CstmPrmtInfo } from '@/types/editor'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const companySeq = searchParams.get('company_seq')
  const aiStaffSeq = searchParams.get('ai_staff_seq')
  const svcCd = searchParams.get('svc_cd')

  try {
    const pool = getPool()
    const conditions: string[] = []
    const params: string[] = []

    if (companySeq) {
      conditions.push('company_seq = ?')
      params.push(companySeq)
    }
    if (aiStaffSeq) {
      conditions.push('ai_staff_seq = ?')
      params.push(aiStaffSeq)
    }
    if (svcCd) {
      conditions.push('svc_cd = ?')
      params.push(svcCd)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const [rows] = await pool.execute<CstmPrmtInfo[] & import('mysql2').RowDataPacket[]>(
      `SELECT * FROM cstm_prmt_info ${where} ORDER BY updt_dt DESC`,
      params
    )

    return NextResponse.json({ success: true, data: rows } satisfies ApiResponse<CstmPrmtInfo[]>)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: '잘못된 요청 형식입니다' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  const { company_seq, ai_staff_seq, svc_cd, prmt_cd, status, prompt, json_schema } = body

  if (!company_seq || !ai_staff_seq || !svc_cd || !prmt_cd || !prompt) {
    return NextResponse.json(
      { success: false, error: '필수 항목: company_seq, ai_staff_seq, svc_cd, prmt_cd, prompt' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  // json_schema 유효성 검증
  if (json_schema != null && typeof json_schema === 'string' && json_schema.trim() !== '') {
    try {
      JSON.parse(json_schema as string)
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON Schema 형식이 올바르지 않습니다' } satisfies ApiResponse<null>,
        { status: 400 }
      )
    }
  }

  try {
    const pool = getPool()
    const [result] = await pool.execute(
      {
        sql: `INSERT INTO cstm_prmt_info (company_seq, ai_staff_seq, svc_cd, prmt_cd, status, prompt, json_schema, rgst_dt, updt_dt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        values: [company_seq, ai_staff_seq, svc_cd, prmt_cd, status || 'Y', prompt, json_schema ?? null],
      }
    )

    const insertId = (result as { insertId: number }).insertId

    const [rows] = await pool.execute(
      'SELECT * FROM cstm_prmt_info WHERE cstm_id = ?',
      [insertId]
    )
    const inserted = (rows as CstmPrmtInfo[])[0]

    return NextResponse.json(
      { success: true, data: inserted } satisfies ApiResponse<CstmPrmtInfo>,
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
      { status: 500 }
    )
  }
}
