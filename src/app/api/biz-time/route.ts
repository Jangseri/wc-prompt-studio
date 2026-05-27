import { NextResponse } from 'next/server'
import { logRoute, withLog } from '@/lib/logger'
import type { ApiResponse } from '@/types/editor'

export const dynamic = 'force-dynamic'

// config-manager 의 businesstime API. 처음엔 dev-backdoor.ploonet.com 의
// wcadmin1 경로로 호출했으나 그 도메인은 nginx 단에서 IP 화이트리스트로
// 막혀 server-to-server 호출이 403 으로 거절됨 (사무실 워크스테이션만
// 허용). 사내 내부 IP 로 직접 호출하면 nginx 우회 가능.
//
//   path: /aice/configManager/v1/businesstime/ais/{ai_staff_seq}/{voice|chat}/curr
//   query: ?callerTp=customer&customerTp=partner (고정값)
//
// 응답 형태:
//   {
//     body: { status: "success", data: { msgIntro: "...", ... } },
//     statusCodeValue: 200,
//     statusCode: "OK"
//   }
//
// dev: BIZTIME_URL=http://10.0.131.55:8151
// 운영 IP 가 다르면 운영 .env 에서 BIZTIME_URL 만 override.
const BIZTIME_URL = process.env.BIZTIME_URL || 'http://10.0.131.55:8151'
const BIZTIME_TIMEOUT = 15000

interface BizTimeResult {
  greeting: string | null
}

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
      if (chnnTp !== 'voice' && chnnTp !== 'chat') {
        return NextResponse.json(
          { success: false, error: "chnn_tp must be 'voice' or 'chat'" } satisfies ApiResponse<null>,
          { status: 400 }
        )
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), BIZTIME_TIMEOUT)

      try {
        // path 안에 ai_staff_seq 와 chnn_tp 를 끼워넣는 RESTful 패턴.
        // ai_staff_seq 는 숫자 문자열이지만 안전을 위해 encode.
        const seqPath = encodeURIComponent(aiStaffSeq)
        const upstreamUrl =
          `${BIZTIME_URL}/aice/configManager/v1/businesstime/ais/${seqPath}/${chnnTp}/curr` +
          `?callerTp=customer&customerTp=partner`

        const res = await withLog(
          '[biz-time] upstream',
          { rid, aiStaffSeq, chnnTp, url: upstreamUrl },
          async () =>
            fetch(upstreamUrl, {
              method: 'GET',
              headers: { accept: 'application/json' },
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

        // upstream 의 정상 응답 신호. statusCodeValue:200 / statusCode:"OK"
        // 둘 다 따로 와서 어느 쪽으로 봐도 되지만, 문자열 "OK" 가 더
        // 명시적이라 그 쪽 우선. 둘 다 빠진 형태가 오면 인사말 없음으로.
        const ok = data?.statusCode === 'OK' || data?.statusCodeValue === 200
        if (!ok) {
          return NextResponse.json({
            success: true,
            data: { greeting: null } satisfies BizTimeResult,
          })
        }

        // msgIntro 는 body.data 안. 이전 API(mapData.msgIntro) 보다 한
        // 단계 더 깊어진 점만 다름.
        const msgIntro = data?.body?.data?.msgIntro
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
