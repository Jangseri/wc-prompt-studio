"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Plus, RefreshCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useStructuringStore } from "@/stores/structuring-store";
import { useCompanyNamesStore } from "@/stores/company-names-store";
import { useCompanyName } from "@/hooks/useCompanyName";
import { useCodeNames } from "@/hooks/useCodeNames";
import {
  CHANNEL_LABEL,
  SVC_CD_ORDER,
  isCallbotSvcCd,
  isChatbotSvcCd,
} from "@/lib/prompt-codes";
import type { CompanyRow } from "@/app/api/companies/route";

const PRMT_ORDER: Record<string, number> = {
  PD2000: 0,
  PD0000: 0,
  PA4000: 1,
  PA1000: 2,
  PC1000: 3,
};

function prmtSort(a: CompanyRow, b: CompanyRow): number {
  const ap = PRMT_ORDER[a.prmt_cd] ?? 99;
  const bp = PRMT_ORDER[b.prmt_cd] ?? 99;
  if (ap !== bp) return ap - bp;
  return a.prmt_cd.localeCompare(b.prmt_cd);
}

interface GroupedByStaff {
  ai_staff_seq: string;
  perChannel: Record<string, CompanyRow[]>;
  mostRecent: string;
}

interface GroupedByCompany {
  company_seq: string;
  mostRecent: string;
  staffGroups: GroupedByStaff[];
}

function groupRows(rows: CompanyRow[]): GroupedByCompany[] {
  const byCompany = new Map<string, Map<string, Map<string, CompanyRow[]>>>();
  for (const row of rows) {
    if (!byCompany.has(row.company_seq)) byCompany.set(row.company_seq, new Map());
    const staffMap = byCompany.get(row.company_seq)!;
    if (!staffMap.has(row.ai_staff_seq)) staffMap.set(row.ai_staff_seq, new Map());
    const channelMap = staffMap.get(row.ai_staff_seq)!;
    if (!channelMap.has(row.svc_cd)) channelMap.set(row.svc_cd, []);
    channelMap.get(row.svc_cd)!.push(row);
  }

  const result: GroupedByCompany[] = [];
  for (const [company_seq, staffMap] of byCompany.entries()) {
    let mostRecent = "";
    const staffGroups: GroupedByStaff[] = [];
    for (const [ai_staff_seq, channelMap] of staffMap.entries()) {
      const perChannel: Record<string, CompanyRow[]> = {};
      let staffMostRecent = "";
      for (const [svc_cd, items] of channelMap.entries()) {
        items.sort(prmtSort);
        perChannel[svc_cd] = items;
        for (const r of items) {
          if (r.updt_dt > staffMostRecent) staffMostRecent = r.updt_dt;
          if (r.updt_dt > mostRecent) mostRecent = r.updt_dt;
        }
      }
      staffGroups.push({ ai_staff_seq, perChannel, mostRecent: staffMostRecent });
    }
    staffGroups.sort((a, b) => b.mostRecent.localeCompare(a.mostRecent));
    result.push({ company_seq, mostRecent, staffGroups });
  }
  result.sort((a, b) => b.mostRecent.localeCompare(a.mostRecent));
  return result;
}

export function CompanySidebar() {
  const [rows, setRows] = useState<CompanyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const applyStatus = useWorkspaceStore((s) => s.applyStatus);
  const selectedCompanySeq = useWorkspaceStore((s) => s.selectedCompanySeq);
  const selectedAiStaffSeq = useWorkspaceStore((s) => s.selectedAiStaffSeq);
  const startNewWorkflow = useWorkspaceStore((s) => s.startNewWorkflow);
  const selectCompanyForManagement = useWorkspaceStore(
    (s) => s.selectCompanyForManagement
  );
  const structuringReset = useStructuringStore((s) => s.reset);
  const companyNamesCache = useCompanyNamesStore((s) => s.cache);
  const prefetchCompanyNames = useCompanyNamesStore((s) => s.prefetchMany);
  const { getCodeName } = useCodeNames();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setRows(data.data as CompanyRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (applyStatus === "success") {
      load();
    }
  }, [applyStatus, load]);

  const groups = useMemo(() => (rows ? groupRows(rows) : []), [rows]);

  // Kick off the name lookup for every visible company once rows are
  // loaded. The store dedupes + limits concurrency, so calling this on
  // every rows change is safe (no refetch for cached entries).
  useEffect(() => {
    if (!rows) return;
    const seqs = Array.from(new Set(rows.map((r) => r.company_seq)));
    prefetchCompanyNames(seqs);
  }, [rows, prefetchCompanyNames]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (g.company_seq.toLowerCase().includes(q)) return true;
      const entry = companyNamesCache[g.company_seq];
      if (
        typeof entry === "string" &&
        entry !== "loading" &&
        entry !== "failed"
      ) {
        return entry.toLowerCase().includes(q);
      }
      return false;
    });
  }, [groups, search, companyNamesCache]);

  // Auto-expand the company whose staff is currently selected so it
  // is visually in context.
  useEffect(() => {
    if (selectedCompanySeq) {
      setExpanded((prev) => {
        if (prev.has(selectedCompanySeq)) return prev;
        const next = new Set(prev);
        next.add(selectedCompanySeq);
        return next;
      });
    }
  }, [selectedCompanySeq]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleNewWorkflow = () => {
    structuringReset();
    startNewWorkflow();
  };

  return (
    <div className="flex h-full flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Companies{rows ? ` · ${groups.length}` : ""}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="새로고침"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleNewWorkflow}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        New workflow
      </button>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="company 검색"
          className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary/50"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto pr-1 -mr-1">
        {loading && rows === null && (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 회사 목록 불러오는 중…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <p className="font-medium">회사 목록을 불러올 수 없습니다</p>
            <p className="mt-1 opacity-80">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-2 rounded-md border border-destructive/40 px-2 py-1 text-[11px] hover:bg-destructive/20"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && rows && filtered.length === 0 && (
          <div className="rounded-md border border-dashed border-border/60 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              {search ? "검색 결과가 없습니다" : "아직 저장된 회사가 없습니다"}
            </p>
          </div>
        )}

        <ul className="space-y-1">
          {filtered.map((g) => {
            const companySelected = g.company_seq === selectedCompanySeq;
            const isOpen = expanded.has(g.company_seq);
            return (
              <li key={g.company_seq}>
                <button
                  type="button"
                  onClick={() => toggle(g.company_seq)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted",
                    isOpen && "bg-muted/60",
                    companySelected && "bg-primary/10 text-primary"
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 shrink-0 transition-transform",
                      isOpen && "rotate-90",
                      companySelected
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <span className="flex min-w-0 flex-1 items-baseline gap-1.5 truncate">
                    <span className="shrink-0 font-medium">
                      {g.company_seq}
                    </span>
                    <CompanyNameSuffix seq={g.company_seq} />
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {g.staffGroups.length} staff
                  </span>
                </button>

                {isOpen && (
                  <div className="ml-5 mt-1 space-y-2 border-l border-border/40 pl-3 pb-2">
                    {g.staffGroups.map((staff) => {
                      const staffSelected =
                        companySelected &&
                        staff.ai_staff_seq === selectedAiStaffSeq;
                      return (
                        <div key={staff.ai_staff_seq}>
                          <button
                            type="button"
                            onClick={() =>
                              selectCompanyForManagement(
                                g.company_seq,
                                staff.ai_staff_seq
                              )
                            }
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[11px] hover:bg-muted",
                              staffSelected &&
                                "bg-primary/15 text-primary font-medium"
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "text-[10px]",
                                  staffSelected
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                )}
                              >
                                staff
                              </span>
                              <span className="font-mono">
                                {staff.ai_staff_seq}
                              </span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {Object.keys(staff.perChannel).length} ch
                            </span>
                          </button>
                          {staffSelected && (
                            <div className="mt-1 space-y-1 pl-3">
                              {Object.entries(staff.perChannel)
                                .sort(([a], [b]) => {
                                  // Canonical channel order (callbot →
                                  // chatbot) to match the Management
                                  // panel, overriding whatever insertion
                                  // order the groupRows loop produced.
                                  const ai = SVC_CD_ORDER.indexOf(a);
                                  const bi = SVC_CD_ORDER.indexOf(b);
                                  const safeA = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
                                  const safeB = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
                                  if (safeA !== safeB) return safeA - safeB;
                                  return a.localeCompare(b);
                                })
                                .map(
                                ([svc_cd, items]) => (
                                  <div
                                    key={svc_cd}
                                    className="rounded border border-border/40 bg-card/30 p-1.5"
                                  >
                                    <div className="mb-1 flex items-center gap-1.5 text-[10px]">
                                      <span
                                        className={cn(
                                          "rounded px-1.5 py-0.5 font-medium",
                                          isCallbotSvcCd(svc_cd) &&
                                            "bg-primary/10 text-primary",
                                          isChatbotSvcCd(svc_cd) &&
                                            "bg-emerald-500/10 text-emerald-400",
                                          !isCallbotSvcCd(svc_cd) &&
                                            !isChatbotSvcCd(svc_cd) &&
                                            "bg-muted/50 text-muted-foreground"
                                        )}
                                      >
                                        {CHANNEL_LABEL[svc_cd] ?? getCodeName(svc_cd)}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {items.map((r) => {
                                        const label = getCodeName(r.prmt_cd);
                                        const isFallback = label === r.prmt_cd;
                                        return (
                                          <span
                                            key={r.prmt_cd}
                                            title={r.prmt_cd}
                                            className={cn(
                                              "rounded bg-muted/40 px-1.5 py-0.5 text-[10px]",
                                              isFallback
                                                ? "font-mono text-muted-foreground"
                                                : "text-foreground/80"
                                            )}
                                          >
                                            {label}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Renders " · {companyName}" after the company_seq in the sidebar
 * header. Three states:
 *   - loading → a thin skeleton bar (keeps layout stable)
 *   - resolved → "· name" with truncation
 *   - failed → nothing (seq stands alone)
 */
function CompanyNameSuffix({ seq }: { seq: string }) {
  const state = useCompanyName(seq);
  if (state.status === "failed") return null;
  if (state.status === "loading") {
    return (
      <span
        aria-hidden
        className="inline-block h-2 w-16 shrink-0 animate-pulse rounded bg-muted-foreground/20"
      />
    );
  }
  return (
    <>
      <span className="shrink-0 text-muted-foreground">·</span>
      <span className="truncate text-muted-foreground" title={state.name}>
        {state.name}
      </span>
    </>
  );
}
