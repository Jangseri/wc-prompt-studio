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

  const {
    company_seq,
    ai_staff_seq,
    svc_cd,
    prmt_cd,
    status,
    prompt,
    json_schema,
    _updt_dt,
    updt_dt,
  } = body
  // Accept both `_updt_dt` (legacy editor convention) and `updt_dt`
  // (unified-workspace management panel) as the optimistic-lock key.
  const lockDt = (_updt_dt ?? updt_dt) as string | undefined

  // json_schema 유효성 검증 (정상 JSON 문자열이거나 null/빈 문자열만 허용)
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

  // PATCH-style dynamic SET: only update the fields the client sent.
  // This keeps the legacy editor (which sends the full row) working
  // while supporting the unified-workspace management panel which
  // sends partial updates (prompt-only or status-only).
  const setClauses: string[] = []
  const setValues: unknown[] = []
  const push = (col: string, value: unknown) => {
    setClauses.push(`${col} = ?`)
    setValues.push(value)
  }
  if (company_seq !== undefined) push('company_seq', company_seq)
  if (ai_staff_seq !== undefined) push('ai_staff_seq', ai_staff_seq)
  if (svc_cd !== undefined) push('svc_cd', svc_cd)
  if (prmt_cd !== undefined) push('prmt_cd', prmt_cd)
  if (status !== undefined) push('status', status)
  if (prompt !== undefined) push('prompt', prompt)
  if (json_schema !== undefined) push('json_schema', json_schema ?? null)

  if (setClauses.length === 0) {
    return NextResponse.json(
      { success: false, error: '수정할 필드가 없습니다' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  try {
    const pool = getPool()

    // 동시 수정 감지 (optimistic locking)
    if (lockDt) {
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
      if (current.updt_dt !== lockDt) {
        return NextResponse.json(
          { success: false, error: '다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해 주세요.' } satisfies ApiResponse<null>,
          { status: 409 }
        )
      }
    }

    // Use the `{ sql, values }` object form (mysql2's QueryOptions
    // overload) — the positional `execute(sql, values)` overload
    // fails to infer types here because `setValues` is unknown[] and
    // TypeScript can't match it against ExecuteValues. The object
    // form is already used in `../route.ts` for the same reason.
    const sql = `UPDATE cstm_prmt_info SET ${setClauses.join(', ')}, updt_dt = NOW() WHERE cstm_id = ?`
    const [result] = await pool.execute({
      sql,
      values: [...setValues, id],
    })

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
