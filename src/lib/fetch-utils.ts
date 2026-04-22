/** 타임아웃을 지원하는 fetch wrapper */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeout?: number }
): Promise<Response> {
  const { timeout = 15000, ...fetchInit } = init ?? {}

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(input, { ...fetchInit, signal: controller.signal })
    return res
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** 재시도를 지원하는 fetch wrapper (GET 전용, 일시적 실패 복구) */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit & { timeout?: number; retries?: number }
): Promise<Response> {
  const { retries = 2, ...rest } = init ?? {}
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(input, rest)
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        // 지수 백오프: 500ms, 1000ms
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }

  throw lastError
}

/** API 에러 메시지 안전하게 추출 */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === '요청 시간이 초과되었습니다') return err.message
    if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
      return '서버에 연결할 수 없습니다'
    }
  }
  return '알 수 없는 오류가 발생했습니다'
}
