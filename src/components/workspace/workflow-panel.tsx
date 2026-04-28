"use client";

import { useWorkspaceStore, type StepId, STEP_ORDER } from "@/stores/workspace-store";
import { StepCard } from "./step-card";
import { SetupStep } from "./steps/setup-step";
import { SourceStep } from "./steps/source-step";
import { AnalysisStep } from "./steps/analysis-step";
import { RegionsStep } from "./steps/regions-step";
import { ApplyStep } from "./steps/apply-step";

const STEP_META: Record<
  StepId,
  { title: string; description: string; render: () => React.ReactNode }
> = {
  setup: {
    title: "Setup",
    description: "company · staff",
    render: () => <SetupStep />,
  },
  source: {
    title: "Source",
    description: "파일 업로드 · 채널 · 업종",
    render: () => <SourceStep />,
  },
  analysis: {
    title: "Analysis",
    description: "업로드 결과 확인 후 초안 생성",
    render: () => <AnalysisStep />,
  },
  regions: {
    title: "Regions",
    description: "프롬프트 구성 편집",
    render: () => <RegionsStep />,
  },
  apply: {
    title: "Apply",
    description: "DB 저장 · 4-레코드 트랜잭션",
    render: () => <ApplyStep />,
  },
};

export function WorkflowPanel() {
  const currentStep = useWorkspaceStore((s) => s.currentStep);
  const setStep = useWorkspaceStore((s) => s.setStep);
  const maxVisitedStepIndex = useWorkspaceStore((s) => s.maxVisitedStepIndex);
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.aiStaffSeq);
  const channel = useWorkspaceStore((s) => s.channel);
  const industry = useWorkspaceStore((s) => s.industry);
  const parsedText = useWorkspaceStore((s) => s.parsedText);
  const imageDescriptions = useWorkspaceStore((s) => s.imageDescriptions);
  const draftGenerated = useWorkspaceStore((s) => s.draftGenerated);
  const applyStatus = useWorkspaceStore((s) => s.applyStatus);

  const currentIdx = STEP_ORDER.indexOf(currentStep);

  // "Done" reflects either (a) the step's required data is filled, or
  // (b) the user has at least visited the step in this workflow. Using
  // the max-visited cursor lets earlier steps stay clickable after the
  // user navigates back.
  const isDone = (step: StepId): boolean => {
    const stepIdx = STEP_ORDER.indexOf(step);
    const visited = stepIdx <= maxVisitedStepIndex && step !== currentStep;
    switch (step) {
      case "setup":
        return companySeq.trim().length > 0 && aiStaffSeq.trim().length > 0;
      case "source":
        return (
          visited && channel !== null && industry.trim().length > 0
        );
      case "analysis":
        return (
          (parsedText.length > 0 || imageDescriptions.length > 0) &&
          draftGenerated
        );
      case "regions":
        return visited;
      case "apply":
        return applyStatus === "success";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Workflow</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Step {currentIdx + 1} / {STEP_ORDER.length} · {STEP_META[currentStep].title}
        </p>
      </div>

      {STEP_ORDER.map((id, idx) => {
        const meta = STEP_META[id];
        const stepIdx = STEP_ORDER.indexOf(id);
        const visited = stepIdx <= maxVisitedStepIndex;
        let status: "current" | "done" | "pending";
        if (id === currentStep) status = "current";
        else if (isDone(id) || visited) status = "done";
        else status = "pending";

        // Any step the user has reached in this workflow stays
        // clickable so they can hop back-and-forth freely. Only
        // never-visited future steps are gated.
        const canJumpHere = visited;

        return (
          <StepCard
            key={id}
            id={id}
            index={idx + 1}
            title={meta.title}
            description={meta.description}
            status={status}
            onExpand={canJumpHere ? () => setStep(id) : undefined}
          >
            {meta.render()}
          </StepCard>
        );
      })}
    </div>
  );
}
