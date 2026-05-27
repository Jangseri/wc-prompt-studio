import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Health 는 폴링 빈도가 높아 매번 INFO 로 찍으면 파일 로거가 잠식됨.
// 상태 전환 시점(OK → fail, fail → OK)에만 로그를 남긴다.
let lastWasOk: boolean | null = null

export async function GET() {
  try {
    const pool = getPool()
    await pool.execute('SELECT 1')
    if (lastWasOk === false) {
      logger.info('[health] recovered to ok')
    }
    lastWasOk = true
    return NextResponse.json({ connected: true })
  } catch (err) {
    let reason = '알 수 없는 오류'
    const msg = err instanceof Error ? err.message : String(err)
    if (lastWasOk !== false) {
      logger.error('[health] db unreachable', { err: msg })
    }
    lastWasOk = false
    if (msg.includes('ECONNREFUSED')) reason = '연결 거부 (VPN 확인)'
    else if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) reason = '연결 시간 초과'
    else if (msg.includes('ACCESS_DENIED') || msg.includes('ER_ACCESS_DENIED')) reason = 'DB 인증 실패'
    else if (msg.includes('PROTOCOL_CONNECTION_LOST')) reason = '연결 끊김'
    else if (msg.includes('ER_BAD_DB_ERROR')) reason = '데이터베이스 없음'
    // 공유 DB 서버 max_connections 한도 초과. health 는 sanitizeDbError 를
    // 거치지 않고 자체 매핑하므로 같은 케이스를 여기도 둔다.
    else if (msg.includes('Too many connections') || msg.includes('ER_CON_COUNT_ERROR')) reason = 'DB 연결 한도 초과'
    else if (msg.includes('password')) reason = 'DB 비밀번호 오류'
    else reason = msg.length > 100 ? msg.substring(0, 100) : msg
    return NextResponse.json({ connected: false, reason })
  }
}
