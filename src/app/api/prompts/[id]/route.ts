import { NextResponse } from 'next/server'
import { getPool, sanitizeDbError } from '@/lib/db'
import type { ApiResponse, CstmPrmtInfo } from '@/types/editor'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id || isNaN(Number(id))) {
    return NextResponse.json(
      { success: false, error: '유효하지 않은 ID입니다' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: '잘못된 요청 형식입니다' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  const { company_seq, ai_staff_seq, svc_cd, prmt_cd, status, prompt, json_schema, _updt_dt } = body

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

    // 동시 수정 감지 (optimistic locking)
    if (_updt_dt) {
      const [existing] = await pool.execute(
        'SELECT updt_dt FROM cstm_prmt_info WHERE cstm_id = ?',
        [id]
      )
      const current = (existing as { updt_dt: string }[])[0]
      if (!current) {
        return NextResponse.json(
          { success: false, error: '해당 프롬프트를 찾을 수 없습니다' } satisfies ApiResponse<null>,
          { status: 404 }
        )
      }
      if (current.updt_dt !== _updt_dt) {
        return NextResponse.json(
          { success: false, error: '다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해 주세요.' } satisfies ApiResponse<null>,
          { status: 409 }
        )
      }
    }

    const [result] = await pool.execute(
      `UPDATE cstm_prmt_info
       SET company_seq = ?, ai_staff_seq = ?, svc_cd = ?, prmt_cd = ?,
           status = ?, prompt = ?, json_schema = ?, updt_dt = NOW()
       WHERE cstm_id = ?`,
      [company_seq as string, ai_staff_seq as string, svc_cd as string, prmt_cd as string, status as string, prompt as string, (json_schema as string) ?? null, id]
    )

    const { affectedRows } = result as { affectedRows: number }
    if (affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: '해당 프롬프트를 찾을 수 없습니다' } satisfies ApiResponse<null>,
        { status: 404 }
      )
    }

    const [rows] = await pool.execute(
      'SELECT * FROM cstm_prmt_info WHERE cstm_id = ?',
      [id]
    )
    const updated = (rows as CstmPrmtInfo[])[0]

    return NextResponse.json({ success: true, data: updated } satisfies ApiResponse<CstmPrmtInfo>)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id || isNaN(Number(id))) {
    return NextResponse.json(
      { success: false, error: '유효하지 않은 ID입니다' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  try {
    const pool = getPool()
    const [result] = await pool.execute(
      'DELETE FROM cstm_prmt_info WHERE cstm_id = ?',
      [id]
    )

    const { affectedRows } = result as { affectedRows: number }
    if (affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: '해당 프롬프트를 찾을 수 없습니다' } satisfies ApiResponse<null>,
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true } satisfies ApiResponse<null>)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeDbError(err) } satisfies ApiResponse<null>,
      { status: 500 }
    )
  }
}
