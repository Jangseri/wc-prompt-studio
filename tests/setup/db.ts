import { createPool, type Pool, type PoolConnection } from 'mysql2/promise'

let testPool: Pool | null = null

function getTestPool(): Pool {
  if (!testPool) {
    const database = process.env.DB_NAME_TEST
    if (!database) {
      throw new Error(
        'DB_NAME_TEST is not set. Configure .env.test.local before running integration tests.'
      )
    }
    testPool = createPool({
      host: process.env.DB_HOST || '192.168.220.222',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 30000,
      dateStrings: true,
    })
  }
  return testPool
}

export async function withTestTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getTestPool().getConnection()
  await conn.beginTransaction()
  try {
    const result = await fn(conn)
    await conn.rollback()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end()
    testPool = null
  }
}

export function isTestDbConfigured(): boolean {
  return !!process.env.DB_NAME_TEST
}
