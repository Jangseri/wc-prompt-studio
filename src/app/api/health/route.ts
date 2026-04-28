import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Health is polled frequently — logging every call would drown the file
// logger. We only log on *transitions* (OK → fail or fail → OK).
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
    else if (msg.includes('password')) reason = 'DB 비밀번호 오류'
    else reason = msg.length > 100 ? msg.substring(0, 100) : msg
    return NextResponse.json({ connected: false, reason })
  }
}
