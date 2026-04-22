"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Plus, RefreshCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useStructuringStore } from "@/stores/structuring-store";
import type { CompanyRow } from "@/app/api/companies/route";

const CHANNEL_LABEL: Record<string, string> = {
  SA1000: "콜봇",
  SA2000: "챗봇",
};

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
      for (const [svc_cd, items] of channelMap.entries()) {
        items.sort(prmtSort);
        perChannel[svc_cd] = items;
        for (const r of items) {
          if (r.updt_dt > mostRecent) mostRecent = r.updt_dt;
        }
      }
      staffGroups.push({ ai_staff_seq, perChannel });
    }
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
  const applyResult = useWorkspaceStore((s) => s.applyResult);
  const reset = useWorkspaceStore((s) => s.reset);
  const structuringReset = useStructuringStore((s) => s.reset);

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
      if (applyResult) {
        setExpanded((prev) => {
          const next = new Set(prev);
          return next;
        });
      }
    }
  }, [applyStatus, applyResult, load]);

  const groups = useMemo(() => (rows ? groupRows(rows) : []), [rows]);
  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups.filter((g) => g.company_seq.toLowerCase().includes(q));
  }, [groups, search]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
        onClick={() => {
          reset();
          structuringReset();
        }}
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
          placeholder="company_seq 검색"
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
          {filtered.map((g) => (
            <li key={g.company_seq}>
              <button
                type="button"
                onClick={() => toggle(g.company_seq)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted",
                  expanded.has(g.company_seq) && "bg-muted/60"
                )}
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                    expanded.has(g.company_seq) && "rotate-90"
                  )}
                />
                <span className="flex-1 font-medium truncate">{g.company_seq}</span>
                <span className="text-[10px] text-muted-foreground">
                  {g.staffGroups.length} staff
                </span>
              </button>

              {expanded.has(g.company_seq) && (
                <div className="ml-5 mt-1 space-y-2 border-l border-border/40 pl-3 pb-2">
                  {g.staffGroups.map((staff) => (
                    <div key={staff.ai_staff_seq} className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>staff</span>
                        <span className="font-medium text-foreground/80">
                          {staff.ai_staff_seq}
                        </span>
                      </div>
                      {Object.entries(staff.perChannel).map(([svc_cd, items]) => (
                        <div key={svc_cd} className="rounded-md border border-border/40 bg-card/40 p-2">
                          <div className="mb-1 flex items-center gap-1.5 text-[10px]">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 font-medium",
                                svc_cd === "SA1000" && "bg-primary/10 text-primary",
                                svc_cd === "SA2000" && "bg-emerald-500/10 text-emerald-400"
                              )}
                            >
                              {CHANNEL_LABEL[svc_cd] ?? svc_cd}
                            </span>
                            <span className="text-muted-foreground">{svc_cd}</span>
                          </div>
                          <ul className="space-y-0.5">
                            {items.map((r) => (
                              <li
                                key={`${r.prmt_cd}-${r.updt_dt}`}
                                className="flex items-center gap-2 text-[11px]"
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    r.status === "Y" ? "bg-emerald-500" : "bg-muted-foreground"
                                  )}
                                  aria-hidden
                                />
                                <span className="font-mono">{r.prmt_cd}</span>
                                <span className="ml-auto text-muted-foreground text-[10px]">
                                  {r.updt_dt.slice(0, 16)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
