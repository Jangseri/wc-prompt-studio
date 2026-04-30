"use client";

import { useCallback } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useStructuringStore } from "@/stores/structuring-store";
import { RegionGrid } from "@/components/structuring/region-grid";
import { getIndustryInputInfoBlock } from "@/lib/regions-presets";
import { StepNav } from "../step-nav";

export function RegionsStep() {
  const industry = useWorkspaceStore((s) => s.industry);
  const channel = useWorkspaceStore((s) => s.channel);
  const goPrev = useWorkspaceStore((s) => s.goPrev);
  const goNext = useWorkspaceStore((s) => s.goNext);
  const canAdvance = useWorkspaceStore((s) => s.canAdvanceFrom("regions"));

  // Regions 의 라이브 편집(prompt) 과 publish 된 스냅샷(publishedPrompt)
  // 의 reference equality 로 dirty 감지. 모든 region updater 가 spread
  // 로 새 객체를 만들고, applyDraft / setAll 만 두 ref 를 같이 맞춤.
  const isDirty = useStructuringStore(
    (s) => s.prompt !== s.publishedPrompt
  );
  const applyDraft = useStructuringStore((s) => s.applyDraft);

  const hasIndustryPreset = getIndustryInputInfoBlock(industry) !== null;

  const handleApply = useCallback(() => {
    applyDraft();
    toast.success("Preview/Chat 에 반영되었습니다");
  }, [applyDraft]);

  // Next 누를 때 미반영 변경이 있으면 한 번 확인. 사용자가 의도적으로
  // 적용 안 한 채 이전 버전을 저장하려는 케이스도 있으므로 차단은
  // 하지 않고 confirm 으로 의사만 묻는다.
  const handleNext = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm(
        "변경 사항이 적용되지 않았습니다.\n적용 없이 이전 버전으로 진행하시겠습니까?"
      );
      if (!ok) return;
    }
    goNext();
  }, [isDirty, goNext]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
        각 구성을 직접 편집하고, 우측 Preview/Chat 에 반영하려면
        아래 <span className="font-medium text-foreground">[적용]</span>{" "}
        버튼을 누르세요.
      </div>

      <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-medium text-primary">
            서버에서 자동 적용된 내용 (모두 편집 가능)
          </p>
          <ul className="space-y-0.5 text-muted-foreground">
            {hasIndustryPreset && (
              <li>
                ·{" "}
                <span className="font-mono text-foreground/80">[입력 정보]</span>{" "}
                블록이 「업무 및 회사 정보 · description」 앞에 자동 삽입됨
                (업종: <span className="font-medium">{industry}</span>)
              </li>
            )}
            <li>
              ·{" "}
              <span className="font-medium">
                {channel === "chatbot"
                  ? "System (Chat 응답 원칙)"
                  : "System (STT/TTS)"}
              </span>{" "}
              기본 규칙이 채워짐
            </li>
            <li>
              · <span className="font-medium">Tool 호출 규칙</span>은 비활성
              상태 (현재 미지원, 최종 출력에도 포함되지 않음)
            </li>
            <li>
              · <span className="font-medium">대답의 범위 / 대화 유지 규칙 / 커스텀 섹션</span>은
              비어있는 상태 (직접 작성)
            </li>
          </ul>
        </div>
      </div>

      <RegionGrid />

      <div className="flex items-center justify-end gap-3 rounded-md border border-border/40 bg-muted/10 px-3 py-2">
        {isDirty ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            미반영 변경 있음
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" />
            Preview/Chat 동기화됨
          </span>
        )}
        <button
          type="button"
          onClick={handleApply}
          disabled={!isDirty}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium shadow-sm transition-all",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90 hover:shadow-md hover:-translate-y-[1px]",
            "active:translate-y-0 active:shadow-sm",
            "disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:shadow-none disabled:hover:bg-muted disabled:hover:translate-y-0 disabled:cursor-not-allowed"
          )}
        >
          적용
        </button>
      </div>

      <StepNav
        onPrev={goPrev}
        onNext={handleNext}
        nextLabel="Next"
        nextDisabled={!canAdvance}
        nextDisabledHint="먼저 초안을 생성하세요"
      />
    </div>
  );
}
