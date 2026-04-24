import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/editor'

export const dynamic = 'force-dynamic'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://host.docker.internal:9002'
const ORCHESTRATOR_TIMEOUT = 15000

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

  const companySeq = body.company_seq as string | undefined
  const fileName = body.file_name as string | undefined

  if (!companySeq || !fileName) {
    return NextResponse.json(
      { success: false, error: 'company_seq and file_name are required' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  // 경로 탐색 방지: 구분자만 차단한다.
  // orchestrator가 파일명에 `..`를 포함하는 명명 규칙을 쓰므로
  // (예: "회사소개.20260210165138..txt") `..` 단독 금지는 과도하다.
  // 실제 path traversal은 경로 구분자가 있어야 가능.
  if (
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName === '..' ||
    fileName === '.'
  ) {
    return NextResponse.json(
      { success: false, error: '유효하지 않은 파일명입니다' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT)

    const url = `${ORCHESTRATOR_URL}/v1/orchestrator/files/${encodeURIComponent(companySeq)}/content?fileName=${encodeURIComponent(fileName)}`
    const res = await fetch(url, { headers: { accept: '*/*' }, signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `오케스트레이터 응답 오류 (${res.status})` } satisfies ApiResponse<null>,
        { status: 502 }
      )
    }

    const data = await res.json()

    if (data.code === 2000) {
      return NextResponse.json({
        success: true,
        data: data.body as string,
      } satisfies ApiResponse<string>)
    }

    return NextResponse.json(
      { success: false, error: data.errMessage || '오케스트레이터 오류' } satisfies ApiResponse<null>,
      { status: 502 }
    )
  } catch (err) {
    const message = err instanceof DOMException && err.name === 'AbortError'
      ? '오케스트레이터 응답 시간 초과'
      : '오케스트레이터에 연결할 수 없습니다'
    return NextResponse.json(
      { success: false, error: message } satisfies ApiResponse<null>,
      { status: 502 }
    )
  }
}
