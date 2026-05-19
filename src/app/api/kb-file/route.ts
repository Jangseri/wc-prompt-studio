import { NextResponse } from 'next/server'
import { logRoute, withLog } from '@/lib/logger'
import type { ApiResponse } from '@/types/editor'

export const dynamic = 'force-dynamic'

// 콤마-구분 multi-URL 지원. 파일 본문은 둘 중 한 서버에만 있으므로
// 순차 시도 — 첫 성공이면 즉시 반환, 어디에도 없으면 마지막 에러로 502.
const ORCHESTRATOR_URLS = (
  process.env.ORCHESTRATOR_URL || 'http://host.docker.internal:9002'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const ORCHESTRATOR_TIMEOUT = 15000

type FetchResult =
  | { success: true; content: string }
  | { success: false; error: string }

async function fetchOne(
  base: string,
  companySeq: string,
  fileName: string,
  rid: string,
  signal: AbortSignal
): Promise<FetchResult> {
  const url = `${base}/v1/orchestrator/files/${encodeURIComponent(companySeq)}/content?fileName=${encodeURIComponent(fileName)}`
  try {
    const res = await withLog(
      '[orchestrator] kb-file',
      { rid, companySeq, fileName, url },
      async () =>
        fetch(url, { headers: { accept: '*/*' }, signal }),
      (r) => ({ status: r.status })
    )

    if (!res.ok) {
      return { success: false, error: `오케스트레이터 응답 오류 (${res.status})` }
    }

    const data = await res.json()

    if (data.code === 2000) {
      return { success: true, content: data.body as string }
    }

    return { success: false, error: data.errMessage || '오케스트레이터 오류' }
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? '오케스트레이터 응답 시간 초과'
        : '오케스트레이터에 연결할 수 없습니다'
    return { success: false, error: message }
  }
}

export async function POST(request: Request) {
  return logRoute('[kb-file] POST', {}, async (rid) => {
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

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT)

    // 순차 시도: 첫 success 면 즉시 반환. 마지막 실패 사유는 보관해서
    // 어디에도 없을 때 응답에 동봉.
    let lastError = ''
    for (const base of ORCHESTRATOR_URLS) {
      const result = await fetchOne(base, companySeq, fileName, rid, controller.signal)
      if (result.success) {
        clearTimeout(timer)
        return NextResponse.json({
          success: true,
          data: result.content,
        } satisfies ApiResponse<string>)
      }
      lastError = result.error
    }
    clearTimeout(timer)

    return NextResponse.json(
      { success: false, error: lastError || '오케스트레이터에 연결할 수 없습니다' } satisfies ApiResponse<null>,
      { status: 502 }
    )
  })
}
