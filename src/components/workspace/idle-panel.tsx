"use client";

import { Sparkles } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useStructuringStore } from "@/stores/structuring-store";

export function IdlePanel() {
  const startNewWorkflow = useWorkspaceStore((s) => s.startNewWorkflow);
  const structuringReset = useStructuringStore((s) => s.reset);

  const handleNew = () => {
    structuringReset();
    startNewWorkflow();
  };

  return (
    <div className="flex h-full flex-col items-center justify-center py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">WC Prompt Studio</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        좌측에서 회사를 선택해 기존 프롬프트를 관리하거나,
        <br />
        새 워크플로우를 시작해 파일로부터 초안을 만드세요.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleNew}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" />
          New workflow
        </button>
        <span className="text-xs text-muted-foreground">
          또는 왼쪽 사이드바에서 회사 선택
        </span>
      </div>
    </div>
  );
}
