import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/editor'

export const dynamic = 'force-dynamic'

// companyInfo lives on a different backend from the KB orchestrator
// (different host/port in production), so we read a dedicated env var.
// Falls back to the address the user provided during integration if no
// override is set.
const COMPANY_INFO_URL =
  process.env.COMPANY_INFO_URL || 'http://192.168.220.222:3030'
const COMPANY_INFO_TIMEOUT = 15000

interface CompanyInfoBody {
  companyName: string
}

export async function POST(request: Request) {
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

    // Upstream is GET with query string: /company-info/search?companySeq=X
    // Returns a flat object: { companyName, ceoName, companyEmail }
    const upstreamUrl = `${COMPANY_INFO_URL}/company-info/search?companySeq=${encodeURIComponent(companySeq)}`
    const res = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { accept: '*/*' },
      signal: controller.signal,
    })
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
}
