"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";

export function SetupStep() {
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.aiStaffSeq);
  const setCompanySeq = useWorkspaceStore((s) => s.setCompanySeq);
  const setAiStaffSeq = useWorkspaceStore((s) => s.setAiStaffSeq);
  const goNext = useWorkspaceStore((s) => s.goNext);
  const canAdvance = useWorkspaceStore((s) => s.canAdvanceFrom("setup"));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            company_seq
          </span>
          <input
            type="text"
            value={companySeq}
            onChange={(e) => setCompanySeq(e.target.value)}
            placeholder="예: __TEST__hospital"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            ai_staff_seq
          </span>
          <input
            type="text"
            value={aiStaffSeq}
            onChange={(e) => setAiStaffSeq(e.target.value)}
            placeholder="예: 1"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            autoComplete="off"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        알파뉴메릭 + <code className="rounded bg-muted px-1">_</code> /{" "}
        <code className="rounded bg-muted px-1">-</code> 조합, 1–64자.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={goNext}
          disabled={!canAdvance}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-smooth"
        >
          다음: 소스 업로드 →
        </button>
      </div>
    </div>
  );
}
