import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles the minimal `node_modules` and a
  // `server.js` entry into `.next/standalone/`, which is what the
  // production Docker image copies. Without this, `next start` would
  // need the full devDeps tree shipped to the server.
  output: "standalone",
};

export default nextConfig;
