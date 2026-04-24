"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  CHANNEL_LABEL,
  SVC_CD_ORDER,
} from "@/lib/prompt-codes";
import type { CstmPrmtInfo } from "@/types/editor";
import { StepNav } from "../step-nav";
import { useState } from "react";

export function SetupStep() {
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.aiStaffSeq);
  const setCompanySeq = useWorkspaceStore((s) => s.setCompanySeq);
  const setAiStaffSeq = useWorkspaceStore((s) => s.setAiStaffSeq);
  const goNext = useWorkspaceStore((s) => s.goNext);
  const canAdvance = useWorkspaceStore((s) => s.canAdvanceFrom("setup"));
  const existingPromptsByService = useWorkspaceStore(
    (s) => s.existingPromptsByService
  );
  const setExistingPromptsByService = useWorkspaceStore(
    (s) => s.setExistingPromptsByService
  );
  const selectCompanyForManagement = useWorkspaceStore(
    (s) => s.selectCompanyForManagement
  );

  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Debounced pre-check against GET /api/prompts to warn early about
  // existing (company, staff) records. Result is cached on the store so
  // SourceStep can use it to block advance on already-taken svc_cds.
  useEffect(() => {
    const co = companySeq.trim();
    const ai = aiStaffSeq.trim();
    if (!co || !ai) {
      setExistingPromptsByService(null);
      setCheckError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true);
      setCheckError(null);
      try {
        const params = new URLSearchParams({
          company_seq: co,
          ai_staff_seq: ai,
        });
        const res = await fetch(`/api/prompts?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        const bySvcCd: Record<string, number> = {};
        for (const row of data.data as CstmPrmtInfo[]) {
          bySvcCd[row.svc_cd] = (bySvcCd[row.svc_cd] ?? 0) + 1;
        }
        setExistingPromptsByService(bySvcCd);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // Non-blocking: log and let the user proceed. Apply will still
        // catch any conflict server-side as a final safety net.
        console.warn("[SetupStep] pre-check failed", err);
        setCheckError((err as Error).message);
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [companySeq, aiStaffSeq, setExistingPromptsByService]);

  const summary = existingPromptsByService;
  const totalExisting = summary
    ? Object.values(summary).reduce((a, b) => a + b, 0)
    : 0;
  const showSummary = !!summary && totalExisting > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            company
          </span>
          <input
            type="text"
            value={companySeq}
            onChange={(e) => setCompanySeq(e.target.value)}
            placeholder="COMPANY SEQ"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            staff
          </span>
          <input
            type="text"
            value={aiStaffSeq}
            onChange={(e) => setAiStaffSeq(e.target.value)}
            placeholder="AI STAFF SEQ"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            autoComplete="off"
          />
        </label>
      </div>

      {checking && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          기존 프롬프트 확인 중…
        </div>
      )}

      {checkError && !checking && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          사전 확인 실패: {checkError} (진행은 가능, Apply 시 최종 검증됨)
        </p>
      )}

      {showSummary && (
        <ExistingPromptsSummary
          bySvcCd={summary!}
          total={totalExisting}
          onGoToManage={() =>
            selectCompanyForManagement(companySeq.trim(), aiStaffSeq.trim())
          }
        />
      )}

      <StepNav
        onNext={goNext}
        nextLabel="Source"
        nextDisabled={!canAdvance}
        nextDisabledHint="company와 staff를 모두 입력하세요"
      />
    </div>
  );
}

function ExistingPromptsSummary({
  bySvcCd,
  total,
  onGoToManage,
}: {
  bySvcCd: Record<string, number>;
  total: number;
  onGoToManage: () => void;
}) {
  // Render known svc_cds in canonical order; unknown ones tacked on at
  // the end for completeness (covers any future codes the FE doesn't
  // yet label).
  const knownRows = SVC_CD_ORDER.map((cd) => ({
    svc_cd: cd,
    label: CHANNEL_LABEL[cd] ?? cd,
    count: bySvcCd[cd] ?? 0,
  }));
  const unknownRows = Object.entries(bySvcCd)
    .filter(([cd]) => !SVC_CD_ORDER.includes(cd))
    .map(([cd, count]) => ({ svc_cd: cd, label: cd, count }));
  const rows = [...knownRows, ...unknownRows];

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
      <div className="flex items-start gap-2 text-xs">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
        <div className="min-w-0">
          <p className="font-medium text-amber-500">
            이 회사·담당자에 이미 등록된 프롬프트가 있습니다 (총 {total}개)
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            아래 조합은 신규 적용이 거부됩니다. 기존 프롬프트는 &apos;프롬프트 관리&apos;에서 편집해주세요.
          </p>
        </div>
      </div>

      <ul className="space-y-1 pl-5">
        {rows.map((r) => (
          <li
            key={r.svc_cd}
            className={cn(
              "flex items-center gap-2 text-[11px]",
              r.count > 0 ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span className="shrink-0">·</span>
            <span className="shrink-0">{r.label}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {r.svc_cd}
            </span>
            <span className="shrink-0">—</span>
            <span className="shrink-0">{r.count}개</span>
            <span
              className={cn(
                "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px]",
                r.count > 0
                  ? "bg-amber-500/20 text-amber-500"
                  : "bg-emerald-500/10 text-emerald-500"
              )}
            >
              {r.count > 0 ? "신규 적용 거부" : "신규 적용 가능"}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onGoToManage}
          className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-1 text-[11px] font-medium text-amber-500 transition-smooth hover:bg-amber-500/20"
        >
          프롬프트 관리로 이동 →
        </button>
      </div>
    </div>
  );
}
