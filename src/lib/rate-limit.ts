/**
 * In-memory IP-keyed token bucket. For abuse-limiting cost-sensitive routes
 * (/api/generate, /api/chat, /api/upload). LRU-capped at MAX_BUCKETS to
 * prevent unbounded memory growth. Replace with a real per-user identifier
 * once auth lands.
 *
 * See docs/unified-workspace-plan.md §6A.5.
 */

export interface RateLimitOptions {
  /** Max tokens the bucket holds. Each request consumes 1 token. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the next token becomes available. 0 if allowed. */
  resetMs: number;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();

let clock: () => number = () => Date.now();

/** Check + consume one token. Returns allowed=false without consuming if empty. */
export function check(ip: string, options: RateLimitOptions): RateLimitResult {
  const now = clock();
  let bucket = buckets.get(ip);

  if (!bucket) {
    bucket = { tokens: options.capacity, lastRefillMs: now };
    buckets.set(ip, bucket);
    pruneStaleIfNeeded();
  } else {
    const elapsedSec = (now - bucket.lastRefillMs) / 1000;
    if (elapsedSec > 0) {
      bucket.tokens = Math.min(
        options.capacity,
        bucket.tokens + elapsedSec * options.refillPerSecond
      );
      bucket.lastRefillMs = now;
    }
    // Promote LRU order: delete + reinsert
    buckets.delete(ip);
    buckets.set(ip, bucket);
  }

  if (bucket.tokens < 1) {
    const missing = 1 - bucket.tokens;
    const resetMs = Math.ceil((missing / options.refillPerSecond) * 1000);
    return { allowed: false, remaining: 0, resetMs };
  }

  bucket.tokens -= 1;
  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    resetMs: 0,
  };
}

function pruneStaleIfNeeded(): void {
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

/** Extract the best-effort client IP from common reverse-proxy headers. */
export function getClientIp(request: Request | Headers): string {
  const headers = request instanceof Headers ? request : request.headers;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

// --- test helpers -----------------------------------------------------------

/** Clear all buckets. Test-only. */
export function _resetForTests(): void {
  buckets.clear();
}

/** Override the time source. Test-only. Pass undefined to restore Date.now. */
export function _setClockForTests(fn: (() => number) | undefined): void {
  clock = fn ?? (() => Date.now());
}

/** Peek at the current bucket count. Test-only. */
export function _bucketCountForTests(): number {
  return buckets.size;
}
