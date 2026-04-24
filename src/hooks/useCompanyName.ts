import { useEffect } from "react";
import { useCompanyNamesStore } from "@/stores/company-names-store";

export type CompanyNameState =
  | { status: "loading" }
  | { status: "resolved"; name: string }
  | { status: "failed" };

/**
 * Read-through cache accessor for a single company name. On mount (and
 * when `seq` changes) it triggers a fetch if the entry is missing.
 *
 * The fetch is deduped by the store, so calling this hook from many
 * components for the same seq makes at most one network request.
 */
export function useCompanyName(seq: string): CompanyNameState {
  const trimmed = seq.trim();
  const entry = useCompanyNamesStore((s) => s.cache[trimmed]);
  const fetchName = useCompanyNamesStore((s) => s.fetchName);

  useEffect(() => {
    if (!trimmed) return;
    if (entry !== undefined) return;
    fetchName(trimmed);
  }, [trimmed, entry, fetchName]);

  if (!trimmed || entry === undefined || entry === "loading") {
    return { status: "loading" };
  }
  if (entry === "failed") return { status: "failed" };
  return { status: "resolved", name: entry };
}
