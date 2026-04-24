"use client";

import { Sparkles } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { RegionGrid } from "@/components/structuring/region-grid";
import { getIndustryInputInfoBlock } from "@/lib/regions-presets";
import { StepNav } from "../step-nav";

export function RegionsStep() {
  const industry = useWorkspaceStore((s) => s.industry);
  const goPrev = useWorkspaceStore((s) => s.goPrev);
  const goNext = useWorkspaceStore((s) => s.goNext);
  const canAdvance = useWorkspaceStore((s) => s.canAdvanceFrom("regions"));

  const hasIndustryPreset = getIndustryInputInfoBlock(industry) !== null;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
        각 구성을 직접 편집하세요. 우측 Preview 탭에서 실시간 미리보기가 보입니다.
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
              · <span className="font-medium">System (STT/TTS)</span> 기본
              규칙이 채워짐
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

      <StepNav
        onPrev={goPrev}
        onNext={goNext}
        nextLabel="Apply"
        nextDisabled={!canAdvance}
        nextDisabledHint="먼저 초안을 생성하세요"
      />
    </div>
  );
}
