import { NextResponse } from 'next/server'
import { logRoute, withLog } from '@/lib/logger'
import type { ApiResponse } from '@/types/editor'

export const dynamic = 'force-dynamic'

// 콤마-구분 multi-URL 지원: 단일 URL 도 동일 로직으로 처리됨.
// dev:  ORCHESTRATOR_URL=http://host:9002
// 운영: ORCHESTRATOR_URL=http://host1:9002,http://host2:9002
//       (각 서버에 서로 다른 회사/파일 데이터가 분산되어 있어 둘 다 조회 후 합침)
const ORCHESTRATOR_URLS = (
  process.env.ORCHESTRATOR_URL || 'http://host.docker.internal:9002'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const ORCHESTRATOR_TIMEOUT = 15000

type FetchResult =
  | { success: true; files: string[] }
  | { success: false; error: string }

async function fetchOne(
  base: string,
  companySeq: string,
  rid: string,
  signal: AbortSignal
): Promise<FetchResult> {
  const url = `${base}/v1/orchestrator/files/${encodeURIComponent(companySeq)}`
  try {
    const res = await withLog(
      '[orchestrator] kb-list',
      { rid, companySeq, url },
      async () =>
        fetch(url, {
          headers: { accept: '*/*' },
          signal,
        }),
      (r) => ({ status: r.status })
    )

    if (!res.ok) {
      return { success: false, error: `오케스트레이터 응답 오류 (${res.status})` }
    }

    const data = await res.json()

    if (data.code === 2000) {
      return {
        success: true,
        files: Array.isArray(data.body) ? (data.body as string[]) : [],
      }
    }

    // "KB 폴더 자체가 아직 생성되지 않음" 같은 상태는 장애가 아니라
    // 단순히 "데이터 없음" 신호로 취급. 멀티 서버 환경에선 회사가 한쪽
    // 서버에만 있는 경우 다른 서버에선 항상 폴더 없음으로 응답.
    const errMsg = typeof data.errMessage === 'string' ? data.errMessage : ''
    const isFolderNotFound = /폴더.*존재하지\s*않|경로를\s*확인/.test(errMsg)
    if (isFolderNotFound) {
      return { success: true, files: [] }
    }

    return { success: false, error: errMsg || '오케스트레이터 오류' }
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? '오케스트레이터 응답 시간 초과'
        : '오케스트레이터에 연결할 수 없습니다'
    return { success: false, error: message }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const companySeq = searchParams.get('company_seq')

  return logRoute('[kb] GET', { companySeq }, async (rid) => {
    if (!companySeq) {
      return NextResponse.json(
        { success: false, error: 'company_seq is required' } satisfies ApiResponse<null>,
        { status: 400 }
      )
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT)

    // 모든 orchestrator 에 병렬 조회. 하나라도 success 면 그 결과들을
    // 합쳐서 반환 (파일명 dedup 하지 않음 — 양쪽 서버에 같은 파일명이
    // 있으면 그대로 둘 다 표시). 전부 실패면 502.
    const results = await Promise.allSettled(
      ORCHESTRATOR_URLS.map((base) =>
        fetchOne(base, companySeq, rid, controller.signal)
      )
    )
    clearTimeout(timer)

    const merged: string[] = []
    let anySuccess = false
    let lastError = ''
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.success) {
          anySuccess = true
          merged.push(...r.value.files)
        } else {
          lastError = r.value.error
        }
      } else {
        lastError = err2msg(r.reason)
      }
    }

    if (!anySuccess) {
      return NextResponse.json(
        { success: false, error: lastError || '오케스트레이터에 연결할 수 없습니다' } satisfies ApiResponse<null>,
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      data: merged,
    } satisfies ApiResponse<string[]>)
  })
}

function err2msg(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
