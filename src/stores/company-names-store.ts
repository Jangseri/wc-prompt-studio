import { create } from "zustand";
import { apiPath } from "@/lib/api-path";

/**
 * Session-memory cache for company names keyed by company_seq.
 *
 *   "loading" — a fetch is in flight
 *   "failed"  — the fetch returned no name (network err / 404 / empty)
 *   string    — resolved companyName
 *
 * Names are considered stable for the session (they rarely change in
 * the source system), so nothing invalidates the cache automatically.
 * If a name edit flow is ever added, expose a `refreshName(seq)` that
 * resets the entry to "loading" before re-fetching.
 *
 * The sidebar calls `prefetchMany(seqs)` once after its rows load, and
 * consumer components use `useCompanyName(seq)` (see hooks/) to pull
 * entries and trigger lazy fetches.
 */

type CacheEntry = "loading" | "failed" | string;

/**
 * Cap on concurrent in-flight requests. 5 is low enough to avoid
 * hammering the orchestrator but high enough that ~50 names finish in
 * a couple of seconds on a fast link.
 *
 * If the orchestrator ever exposes a bulk endpoint, swap the N-parallel
 * implementation of `prefetchMany` with a single bulk call; the
 * external hook/store API does not change.
 */
const MAX_CONCURRENT = 5;

interface CompanyNamesStore {
  cache: Record<string, CacheEntry>;
  /**
   * Fetch a single name into the cache. Idempotent — returns early if
   * the entry is already loading/resolved/failed. Consumers that want
   * to force a retry should call `resetName(seq)` first.
   */
  fetchName: (seq: string) => Promise<void>;
  /**
   * Trigger fetches for every seq that isn't already in the cache.
   * Internally throttles to `MAX_CONCURRENT` parallel requests.
   */
  prefetchMany: (seqs: string[]) => Promise<void>;
  /** Remove a cache entry so the next read will re-fetch. */
  resetName: (seq: string) => void;
}

async function fetchCompanyName(seq: string): Promise<string | null> {
  try {
    const res = await fetch(apiPath("/api/company-info"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companySeq: seq }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success) return null;
    const name = data?.data?.companyName;
    return typeof name === "string" && name.trim().length > 0 ? name : null;
  } catch {
    return null;
  }
}

export const useCompanyNamesStore = create<CompanyNamesStore>((set, get) => ({
  cache: {},

  fetchName: async (seq) => {
    const trimmed = seq.trim();
    if (!trimmed) return;
    const existing = get().cache[trimmed];
    if (existing !== undefined) return; // loading/failed/resolved — skip
    set((state) => ({ cache: { ...state.cache, [trimmed]: "loading" } }));
    const name = await fetchCompanyName(trimmed);
    set((state) => ({
      cache: { ...state.cache, [trimmed]: name ?? "failed" },
    }));
  },

  prefetchMany: async (seqs) => {
    const { cache, fetchName } = get();
    const pending = Array.from(
      new Set(
        seqs
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && cache[s] === undefined)
      )
    );
    if (pending.length === 0) return;

    // Simple N-at-a-time queue. `fetchName` is idempotent so we rely
    // on its early-return guard to dedupe concurrent calls for the
    // same seq (won't happen after the dedupe above, but defensive).
    let cursor = 0;
    async function worker() {
      while (cursor < pending.length) {
        const idx = cursor++;
        await fetchName(pending[idx]);
      }
    }
    const workerCount = Math.min(MAX_CONCURRENT, pending.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  },

  resetName: (seq) =>
    set((state) => {
      if (state.cache[seq] === undefined) return state;
      const next = { ...state.cache };
      delete next[seq];
      return { cache: next };
    }),
}));
