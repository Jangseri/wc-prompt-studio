import { NextResponse } from 'next/server'
import { logRoute, withLog } from '@/lib/logger'
import type { ApiResponse } from '@/types/editor'

export const dynamic = 'force-dynamic'

// companyInfo 백엔드는 KB orchestrator 와 다른 호스트/포트.
// dev/운영 path·method 가 다르므로 env 세 개로 분기:
//   COMPANY_INFO_URL    — base URL (예: http://host:port)
//   COMPANY_INFO_PATH   — 엔드포인트 path (default: /company-info/search)
//   COMPANY_INFO_METHOD — GET | POST (default: GET)
// GET 은 ?companySeq=X 쿼리, POST 는 JSON body {"companySeq":"X"}.
const COMPANY_INFO_URL =
  process.env.COMPANY_INFO_URL || 'http://192.168.220.222:3030'
const COMPANY_INFO_PATH =
  process.env.COMPANY_INFO_PATH || '/company-info/search'
const COMPANY_INFO_METHOD =
  (process.env.COMPANY_INFO_METHOD || 'GET').toUpperCase() === 'POST'
    ? 'POST'
    : 'GET'
const COMPANY_INFO_TIMEOUT = 15000

interface CompanyInfoBody {
  companyName: string
}

export async function POST(request: Request) {
  return logRoute('[company-info] POST', {}, async (rid) => {
    let body: { companySeq?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: '잘못된 요청 형식입니다' } satisfies ApiResponse<null>,
        { status: 400 }
      )
    }

    const companySeq = typeof body?.companySeq === 'string' ? body.companySeq.trim() : ''
    if (!companySeq) {
      return NextResponse.json(
        { success: false, error: 'companySeq is required' } satisfies ApiResponse<null>,
        { status: 400 }
      )
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), COMPANY_INFO_TIMEOUT)

      // dev:  GET  ${URL}${PATH}?companySeq=X         → { companyName, ceoName, companyEmail }
      // 운영: POST ${URL}${PATH}  body={"companySeq":"X"} → { companyName }
      const isPost = COMPANY_INFO_METHOD === 'POST'
      const baseUrl = `${COMPANY_INFO_URL}${COMPANY_INFO_PATH}`
      const upstreamUrl = isPost
        ? baseUrl
        : `${baseUrl}?companySeq=${encodeURIComponent(companySeq)}`
      const res = await withLog(
        '[company-info] upstream',
        { rid, companySeq, url: upstreamUrl, method: COMPANY_INFO_METHOD },
        async () =>
          fetch(upstreamUrl, {
            method: COMPANY_INFO_METHOD,
            headers: isPost
              ? { accept: '*/*', 'content-type': 'application/json' }
              : { accept: '*/*' },
            body: isPost ? JSON.stringify({ companySeq }) : undefined,
            signal: controller.signal,
          }),
        (r) => ({ status: r.status })
      )
      clearTimeout(timer)

      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: `companyInfo 응답 오류 (${res.status})` } satisfies ApiResponse<null>,
          { status: 502 }
        )
      }

      const data = await res.json()

      // Only companyName is surfaced to the client; other fields (ceoName,
      // companyEmail) aren't needed by the sidebar.
      const companyName =
        typeof data?.companyName === 'string' ? data.companyName : null

      if (!companyName) {
        return NextResponse.json(
          {
            success: false,
            error: '회사 정보를 찾을 수 없습니다',
          } satisfies ApiResponse<null>,
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: { companyName } as CompanyInfoBody,
      } satisfies ApiResponse<CompanyInfoBody>)
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'companyInfo 응답 시간 초과'
          : 'companyInfo 서버에 연결할 수 없습니다'
      return NextResponse.json(
        { success: false, error: message } satisfies ApiResponse<null>,
        { status: 502 }
      )
    }
  })
}
