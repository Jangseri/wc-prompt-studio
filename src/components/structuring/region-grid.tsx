"use client";

import { ChevronsDown, ChevronsUp, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStructuringStore } from "@/stores/structuring-store";
import { REGION_ORDER } from "@/types/structuring";
import { RegionCard } from "./region-card";

export function RegionGrid() {
  const expandAll = useStructuringStore((s) => s.expandAll);
  const collapseAll = useStructuringStore((s) => s.collapseAll);
  const reset = useStructuringStore((s) => s.reset);
  const anyExpanded = useStructuringStore((s) => s.expandedRegions.size > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">영역화</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={anyExpanded ? collapseAll : expandAll}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-smooth"
          >
            {anyExpanded ? (
              <>
                <ChevronsUp className="h-3.5 w-3.5" />
                모두 접기
              </>
            ) : (
              <>
                <ChevronsDown className="h-3.5 w-3.5" />
                모두 펼치기
              </>
            )}
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초기화
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
        {REGION_ORDER.map((id) => (
          <div
            key={id}
            // Branching spans the full row so the bottom line naturally
            // becomes [custom] [answerScope] side by side.
            className={cn(id === "branching" && "xl:col-span-2")}
          >
            <RegionCard id={id} />
          </div>
        ))}
      </div>
    </div>
  );
}
