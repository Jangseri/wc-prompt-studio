import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Minimal server-side file logger.
 *
 *   logger.info("message", { extra: "context" })
 *   logger.warn("message", err)
 *   logger.error("message", err)
 *
 * Writes one line per call to `logs/app-YYYY-MM-DD.log` (daily file) AND
 * mirrors to the terminal via console.* so the dev experience stays the
 * same. If the file write fails for any reason we swallow the error —
 * logging should never break the request it's trying to document.
 *
 * Scope: server-only. Do not import this from client components — it
 * uses `node:fs` which will not resolve in the browser bundle. Client
 * components should use `console.*` as before; if you need centralized
 * client logging later, add a `/api/log` endpoint that funnels browser
 * messages into this same file.
 */

const LOG_DIR = path.join(process.cwd(), "logs");

type Level = "info" | "warn" | "error";

function padLevel(level: Level): string {
  // Fixed-width column so log lines align when eyeballed.
  return level.toUpperCase().padEnd(5);
}

function stringifyExtra(extra: unknown): string {
  if (extra === undefined) return "";
  if (extra instanceof Error) {
    return ` ${extra.name}: ${extra.message}${extra.stack ? `\n${extra.stack}` : ""}`;
  }
  try {
    return ` ${JSON.stringify(extra)}`;
  } catch {
    return ` [unstringifiable]`;
  }
}

async function writeLine(level: Level, message: string, extra?: unknown): Promise<void> {
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timestamp = now.toISOString();
  const file = path.join(LOG_DIR, `app-${isoDate}.log`);
  const line = `${timestamp} [${padLevel(level)}] ${message}${stringifyExtra(extra)}\n`;

  // Mirror to the terminal for dev/debug visibility. The file append
  // happens in parallel — we don't await the mirror so console output
  // is synchronous and the caller doesn't stall on disk I/O.
  if (level === "error") console.error(line.trimEnd());
  else if (level === "warn") console.warn(line.trimEnd());
  else console.log(line.trimEnd());

  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(file, line, "utf8");
  } catch (err) {
    // If the file write itself fails, surface a one-off warning but
    // don't throw — caller context already has the original error on
    // the terminal.
    console.warn(
      `[logger] failed to append ${file}: ${(err as Error).message}`
    );
  }
}

export const logger = {
  info: (message: string, extra?: unknown) => {
    void writeLine("info", message, extra);
  },
  warn: (message: string, extra?: unknown) => {
    void writeLine("warn", message, extra);
  },
  error: (message: string, extra?: unknown) => {
    void writeLine("error", message, extra);
  },
};

// ─── Observability helpers ─────────────────────────────────────────
//
// `makeRequestId` + `withLog` + `logRoute` together give every server
// request a short correlation ID and a "start → ok | slow ok | fail"
// trio of log lines. Calls that exceed SLOW_MS get bumped to WARN so
// they're visible in dashboards. Status-aware logRoute also routes
// 4xx/5xx responses to WARN/ERROR even when they don't throw.

const SLOW_MS = 5000;

/** Short correlation ID (not crypto-meaningful) for tying together
 *  the multiple log lines a single HTTP request produces. */
export function makeRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** Wrap an async I/O operation (LLM call, external fetch, DB mutation)
 *  in a start/ok/fail trio. `okMeta` extracts response-shape metadata
 *  (length, usage, …) only after success so we don't pay for it on
 *  the failure path. */
export async function withLog<T>(
  op: string,
  meta: Record<string, unknown>,
  fn: () => Promise<T>,
  okMeta?: (result: T) => Record<string, unknown>
): Promise<T> {
  const t0 = Date.now();
  logger.info(`${op} start`, meta);
  try {
    const result = await fn();
    const ms = Date.now() - t0;
    const extra = okMeta ? okMeta(result) : {};
    const finalMeta = { ...meta, ms, ...extra };
    if (ms > SLOW_MS) logger.warn(`${op} slow ok`, finalMeta);
    else logger.info(`${op} ok`, finalMeta);
    return result;
  } catch (err) {
    logger.error(`${op} fail`, { ...meta, ms: Date.now() - t0, err });
    throw err;
  }
}

/** Wrap a Next.js route handler. Generates a `rid`, hands it to the
 *  handler body, and routes the final log line by HTTP status:
 *    5xx → ERROR, 4xx → WARN, slow 2xx → WARN, otherwise INFO.
 *  Use the `rid` in any sub-calls so a single request's logs can be
 *  grepped by ID. */
export async function logRoute<T extends Response>(
  op: string,
  meta: Record<string, unknown>,
  fn: (rid: string) => Promise<T>
): Promise<T> {
  const rid = makeRequestId();
  const t0 = Date.now();
  logger.info(`${op} start`, { rid, ...meta });
  try {
    const res = await fn(rid);
    const ms = Date.now() - t0;
    const status = res.status;
    const finalMeta = { rid, ms, status, ...meta };
    if (status >= 500) logger.error(`${op} server err`, finalMeta);
    else if (status >= 400) logger.warn(`${op} client err`, finalMeta);
    else if (ms > SLOW_MS) logger.warn(`${op} slow ok`, finalMeta);
    else logger.info(`${op} ok`, finalMeta);
    return res;
  } catch (err) {
    logger.error(`${op} fail`, { rid, ms: Date.now() - t0, ...meta, err });
    throw err;
  }
}
