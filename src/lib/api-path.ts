/**
 * 앱이 path prefix 아래에서 서빙될 때 (예: dev-backdoor 의
 * `/prompt-studio/`) raw fetch 호출의 절대경로에 prefix 를 붙여주는
 * 헬퍼. dev 환경에선 NEXT_PUBLIC_BASE_PATH 가 비어있어 no-op.
 *
 * basePath 는 next.config.ts 에서 같은 env 로부터 읽어 Next 자체의
 * 자산·라우팅에도 적용된다 — 이 헬퍼는 코드 안의 raw fetch 만 처리.
 */

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * 절대경로(`/api/foo`) 앞에 BASE_PATH 를 붙인다.
 * - 절대 URL(`http://...`) 또는 이미 prefix 가 붙은 경로는 그대로 반환
 * - prefix 가 빈 문자열인 경우(dev) 입력값 그대로 반환
 */
export function apiPath(path: string): string {
  if (!BASE_PATH) return path;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith(BASE_PATH + "/") || path === BASE_PATH) return path;
  return `${BASE_PATH}${path}`;
}
