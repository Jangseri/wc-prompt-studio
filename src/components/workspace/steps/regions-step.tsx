"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { RegionGrid } from "@/components/structuring/region-grid";

export function RegionsStep() {
  const goPrev = useWorkspaceStore((s) => s.goPrev);
  const goNext = useWorkspaceStore((s) => s.goNext);
  const canAdvance = useWorkspaceStore((s) => s.canAdvanceFrom("regions"));

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
        8영역을 직접 편집하세요. 우측 Preview 탭에서 실시간 미리보기가 보입니다.
      </div>

      <RegionGrid />

      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <button
          type="button"
          onClick={goPrev}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary/40"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canAdvance}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음: 적용 →
        </button>
      </div>
    </div>
  );
}
