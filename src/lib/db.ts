import { createPool, type Pool } from 'mysql2/promise'
import { logger } from './logger'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = createPool({
      host: process.env.DB_HOST || '192.168.220.222',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'orchestrator',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 30000,
      idleTimeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 30000,
      dateStrings: true,
    })

    // 풀 에러 이벤트 핸들링 (커넥션 끊김 등)
    try {
      pool.pool.on('error', (err) => {
        logger.error('[DB Pool Error] ' + err.message, err)
        // 치명적 에러 시 풀 재생성
        if (err.message.includes('PROTOCOL_CONNECTION_LOST') || err.message.includes('ECONNREFUSED')) {
          pool = null
        }
      })
    } catch {
      // pool.pool이 없는 환경 (테스트 mock 등) 무시
    }
  }
  return pool
}

/** API 응답용 에러 메시지 (내부 정보 마스킹) */
export function sanitizeDbError(err: unknown): string {
  if (err instanceof Error) {
    // 커넥션 에러
    if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
      return '데이터베이스에 연결할 수 없습니다'
    }
    if (err.message.includes('PROTOCOL_CONNECTION_LOST')) {
      return '데이터베이스 연결이 끊어졌습니다'
    }
    // MySQL max_connections 초과 — 우리 풀(connectionLimit:5) 한도가 아니라
    // 공유 DB 서버 한도가 다른 서비스들로 다 찼다는 신호. 사용자에겐 일시적
    // 혼잡으로 안내해서 raw stack 이 그대로 노출되지 않도록.
    if (err.message.includes('Too many connections') || err.message.includes('ER_CON_COUNT_ERROR')) {
      return 'DB 연결 한도 초과 — 잠시 후 다시 시도해주세요'
    }
    if (err.message.includes('ER_DUP_ENTRY')) {
      return '중복된 데이터가 존재합니다'
    }
    if (err.message.includes('ER_DATA_TOO_LONG')) {
      return '입력 데이터가 너무 깁니다'
    }
    if (err.message.includes('ER_NO_DEFAULT_FOR_FIELD')) {
      return '필수 필드가 누락되었습니다'
    }
  }
  logger.error('[DB Error]', err)
  return '서버 내부 오류가 발생했습니다'
}
