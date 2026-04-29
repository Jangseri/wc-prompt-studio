FROM node:20-alpine AS base

# ── Stage 1: install dependencies ──────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ─────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 리버스 프록시 뒤에 path prefix 로 노출되는 환경에서 next.config.ts 가
# 같은 env 를 읽어 basePath 를 적용한다. NEXT_PUBLIC_ prefix 라 빌드 시
# 클라이언트 번들에도 인라인되어 fetch 헬퍼(apiPath) 도 prefix 를 붙임.
# 비어있으면 root mount(localhost dev 동일).
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ── Stage 3: runner (production image) ─────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user. docker-compose.yml may override at runtime via
# `user: "<host-uid>:<host-gid>"` so the mounted ./logs volume is writable
# from the host without chown gymnastics.
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Standalone output (next.config.ts: output: "standalone") includes the
# minimal node_modules subset + server.js. Static assets are kept under
# .next/static and copied separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Logs directory — server-side file logger writes app-YYYY-MM-DD.log.
# Compose mounts ./logs from the host into here.
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
