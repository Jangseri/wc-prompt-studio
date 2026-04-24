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
