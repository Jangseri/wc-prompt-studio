import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/editor'

export const dynamic = 'force-dynamic'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://host.docker.internal:9002'
const ORCHESTRATOR_TIMEOUT = 15000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const companySeq = searchParams.get('company_seq')

  if (!companySeq) {
    return NextResponse.json(
      { success: false, error: 'company_seq is required' } satisfies ApiResponse<null>,
      { status: 400 }
    )
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT)

    const res = await fetch(`${ORCHESTRATOR_URL}/v1/orchestrator/files/${encodeURIComponent(companySeq)}`, {
      headers: { accept: '*/*' },
      signal: controller.signal,
    })
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
        data: data.body as string[],
      } satisfies ApiResponse<string[]>)
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
