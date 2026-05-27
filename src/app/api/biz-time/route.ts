import { NextResponse } from 'next/server'
import { logRoute, withLog } from '@/lib/logger'
import type { ApiResponse } from '@/types/editor'

export const dynamic = 'force-dynamic'

// dev-backdoor 의 wcadmin biz-time API base. company-info / orchestrator 와
// 마찬가지로 환경마다 호스트가 달라질 수 있으므로 env 로 분리.
// path 의 `/v1/dev/...` 가 환경별로 바뀔 여지가 있어 BIZTIME_PATH 도 분리
// 해두면 운영에서 `/v1/prod/...` 같은 변형에 환경변수만 바꿔서 대응 가능.
const BIZTIME_URL =
  process.env.BIZTIME_URL ||
  'https://dev-backdoor.ploonet.com/wcadmin1/wc-be-adm-api'
const BIZTIME_PATH = process.env.BIZTIME_PATH || '/v1/dev/biz-time/dayon/curr'
const BIZTIME_TIMEOUT = 15000

interface BizTimeResult {
  greeting: string | null
}

/**
 * upstream 응답 형태:
 * {
 *   resultStatus: 200,
 *   mapData: {
 *     msgIntro: "안녕하세요 ...",   // ← 우리가 쓰는 인사말
 *     timeType: "on" | "off",
 *     busy: { busyMsg, busyAct },
 *     ...
 *   }
 * }
 *
 * 다른 필드(busy, timeType 등)도 추후 활용 가능성이 있지만 현재 요구는
 * "기존 회사 테스트 채팅의 인사말" 뿐이라 msgIntro 만 추출해서 단순화한다.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const aiStaffSeq = searchParams.get('ai_staff_seq')
  const chnnTp = searchParams.get('chnn_tp')

  return logRoute(
    '[biz-time] GET',
    { aiStaffSeq, chnnTp },
    async (rid) => {
      if (!aiStaffSeq) {
        return NextResponse.json(
          { success: false, error: 'ai_staff_seq is required' } satisfies ApiResponse<null>,
          { status: 400 }
        )
      }
      // chnn_tp 화이트리스트. upstream 이 받는 값이 voice/chat 두 가지로
      // 알려져 있으므로 그 외는 거부해서 잘못된 호출을 조기 차단.
      if (chnnTp !== 'voice' && chnnTp !== 'chat') {
        return NextResponse.json(
          { success: false, error: "chnn_tp must be 'voice' or 'chat'" } satisfies ApiResponse<null>,
          { status: 400 }
        )
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), BIZTIME_TIMEOUT)

      try {
        // upstream 쿼리: searchKey 는 빈 문자열 그대로, type=ais 는 고정값
        // (사용자 제공 URL 기준). seq 만 ai_staff_seq 로 치환.
        const qs = new URLSearchParams({
          searchKey: '',
          type: 'ais',
          chnnTp,
          seq: aiStaffSeq,
        })
        const upstreamUrl = `${BIZTIME_URL}${BIZTIME_PATH}?${qs.toString()}`

        const res = await withLog(
          '[biz-time] upstream',
          { rid, aiStaffSeq, chnnTp, url: upstreamUrl },
          async () =>
            fetch(upstreamUrl, {
              method: 'GET',
              headers: { accept: '*/*' },
              signal: controller.signal,
            }),
          (r) => ({ status: r.status })
        )

        if (!res.ok) {
          return NextResponse.json(
            { success: false, error: `biz-time 응답 오류 (${res.status})` } satisfies ApiResponse<null>,
            { status: 502 }
          )
        }

        const data = await res.json()

        // resultStatus 가 200 이 아니면 정상 응답이 아닌 것으로 보고
        // greeting=null 로 전달. 클라이언트는 이걸 "인사말 없음" 으로
        // 처리하면 됨 (502 로 안 올리는 이유: 채팅 자체가 막히면 곤란).
        if (data?.resultStatus !== 200) {
          return NextResponse.json({
            success: true,
            data: { greeting: null } satisfies BizTimeResult,
          })
        }

        const msgIntro = data?.mapData?.msgIntro
        const greeting =
          typeof msgIntro === 'string' && msgIntro.trim().length > 0
            ? msgIntro
            : null

        return NextResponse.json({
          success: true,
          data: { greeting } satisfies BizTimeResult,
        } satisfies ApiResponse<BizTimeResult>)
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === 'AbortError'
            ? 'biz-time 응답 시간 초과'
            : 'biz-time 서버에 연결할 수 없습니다'
        return NextResponse.json(
          { success: false, error: message } satisfies ApiResponse<null>,
          { status: 502 }
        )
      } finally {
        clearTimeout(timer)
      }
    }
  )
}

export type { BizTimeResult }
