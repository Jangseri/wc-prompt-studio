import { describe, it, expect } from 'vitest'
import { sanitizeDbError } from '@/lib/db'

describe('sanitizeDbError', () => {
  it('masks connection-refused errors with a Korean user message', () => {
    const msg = sanitizeDbError(new Error('connect ECONNREFUSED 127.0.0.1:3306'))
    expect(msg).toBe('데이터베이스에 연결할 수 없습니다')
  })

  it('masks timeout errors', () => {
    const msg = sanitizeDbError(new Error('ETIMEDOUT after 30s'))
    expect(msg).toBe('데이터베이스에 연결할 수 없습니다')
  })

  it('masks protocol-connection-lost errors', () => {
    const msg = sanitizeDbError(new Error('PROTOCOL_CONNECTION_LOST'))
    expect(msg).toBe('데이터베이스 연결이 끊어졌습니다')
  })

  it('maps ER_DUP_ENTRY to duplicate-data message', () => {
    const msg = sanitizeDbError(new Error("ER_DUP_ENTRY: Duplicate entry 'x-y-z' for key 'uniq'"))
    expect(msg).toBe('중복된 데이터가 존재합니다')
  })

  it('maps ER_DATA_TOO_LONG to input-too-long message', () => {
    const msg = sanitizeDbError(new Error('ER_DATA_TOO_LONG: Data too long'))
    expect(msg).toBe('입력 데이터가 너무 깁니다')
  })

  it('maps ER_NO_DEFAULT_FOR_FIELD to missing-field message', () => {
    const msg = sanitizeDbError(new Error('ER_NO_DEFAULT_FOR_FIELD: Field \"x\" has no default'))
    expect(msg).toBe('필수 필드가 누락되었습니다')
  })

  it('falls back to generic message for unknown errors', () => {
    const msg = sanitizeDbError(new Error('some wild thing went wrong'))
    expect(msg).toBe('서버 내부 오류가 발생했습니다')
  })

  it('handles non-Error values', () => {
    expect(sanitizeDbError('a plain string')).toBe('서버 내부 오류가 발생했습니다')
    expect(sanitizeDbError(null)).toBe('서버 내부 오류가 발생했습니다')
    expect(sanitizeDbError(undefined)).toBe('서버 내부 오류가 발생했습니다')
  })

  it('does not leak raw error text in the returned user message', () => {
    const secret = 'password=s3cr3t host=internal.db'
    const out = sanitizeDbError(new Error(secret))
    expect(out).not.toContain('s3cr3t')
    expect(out).not.toContain('internal.db')
  })
})
