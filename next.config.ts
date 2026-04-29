import type { NextConfig } from "next";

// 리버스 프록시 뒤에 path prefix 로 노출되는 환경(dev-backdoor 같은)에서
// Next.js 가 자기 mount path 를 알도록 빌드 시 env 로 주입한다. dev 에선
// env 가 없어서 빈 문자열 → 기존 localhost 동작 그대로.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Standalone output bundles the minimal `node_modules` and a
  // `server.js` entry into `.next/standalone/`, which is what the
  // production Docker image copies. Without this, `next start` would
  // need the full devDeps tree shipped to the server.
  output: "standalone",
  basePath,
};

export default nextConfig;
