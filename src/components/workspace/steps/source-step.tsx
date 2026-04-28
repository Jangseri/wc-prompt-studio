"use client";

import { useCallback, useMemo, useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { resolveChannelCode, type Channel } from "@/lib/prompt-codes";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceFileDropzone } from "../workspace-file-dropzone";
import { StepNav } from "../step-nav";

const DEFAULT_INDUSTRIES = ["일반", "병원"] as const;

export function SourceStep() {
  const sourceFiles = useWorkspaceStore((s) => s.sourceFiles);
  const setSourceFiles = useWorkspaceStore((s) => s.setSourceFiles);
  const channel = useWorkspaceStore((s) => s.channel);
  const setChannel = useWorkspaceStore((s) => s.setChannel);
  const industry = useWorkspaceStore((s) => s.industry);
  const setIndustry = useWorkspaceStore((s) => s.setIndustry);
  const isParsing = useWorkspaceStore((s) => s.isParsing);
  const goPrev = useWorkspaceStore((s) => s.goPrev);
  const goNext = useWorkspaceStore((s) => s.goNext);
  const canAdvance = useWorkspaceStore((s) => s.canAdvanceFrom("source"));
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.aiStaffSeq);
  const existingPromptsByService = useWorkspaceStore(
    (s) => s.existingPromptsByService
  );
  const selectCompanyForManagement = useWorkspaceStore(
    (s) => s.selectCompanyForManagement
  );

  const [customIndustry, setCustomIndustry] = useState(
    !DEFAULT_INDUSTRIES.includes(industry as (typeof DEFAULT_INDUSTRIES)[number]) &&
      industry !== ""
  );

  // setSourceFiles 호출이 이전 분석을 날릴 때 사용자에게 알리기 위해
  // 래핑. 분석 상태가 바뀔 때마다 이 컴포넌트가 리렌더되는 걸 피하려고
  // store hook 대신 getState() 로 즉시 조회.
  const handleFilesChange = useCallback(
    (files: File[]) => {
      const prev = useWorkspaceStore.getState();
      const hadAnalysis =
        prev.parsedText.length > 0 ||
        prev.imageDescriptions.length > 0 ||
        prev.draftGenerated;
      setSourceFiles(files);
      if (hadAnalysis) {
        toast.info(
          "파일이 변경되어 이전 분석을 초기화했습니다. Analysis에서 다시 실행하세요."
        );
      }
    },
    [setSourceFiles]
  );

  // Compute the resolved svc_cd for the currently-picked (channel, industry)
  // pair; if it already has existing rows, surface an inline block.
  const conflict = useMemo(() => {
    if (!channel || !industry.trim()) return null;
    const svcCd = resolveChannelCode(channel, industry).svc_cd;
    const count = existingPromptsByService?.[svcCd] ?? 0;
    if (count <= 0) return null;
    return { svcCd, count };
  }, [channel, industry, existingPromptsByService]);

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">
          소스 파일 (엑셀 · 플로우차트 이미지)
        </label>
        <WorkspaceFileDropzone
          files={sourceFiles}
          onChange={handleFilesChange}
          disabled={isParsing}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">채널</legend>
        <div className="flex gap-2">
          {(["callbot", "chatbot"] as Channel[]).map((c) => (
            <label
              key={c}
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition-smooth ${
                channel === c
                  ? "border-primary/60 bg-primary/10 text-primary font-medium"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="channel"
                value={c}
                checked={channel === c}
                onChange={() => setChannel(c)}
                className="sr-only"
              />
              {c === "callbot" ? "콜봇" : "챗봇"}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">업종</legend>
        {!customIndustry ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-2">
              {DEFAULT_INDUSTRIES.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setIndustry(opt)}
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition-smooth ${
                    industry === opt
                      ? "border-primary/60 bg-primary/10 text-primary font-medium"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomIndustry(true);
                setIndustry("");
              }}
              className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40"
            >
              직접입력
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="업종을 입력하세요"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <button
              type="button"
              onClick={() => {
                setCustomIndustry(false);
                setIndustry("");
              }}
              className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40"
            >
              목록에서 선택
            </button>
          </div>
        )}
      </fieldset>

      {conflict && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
          <Ban className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-destructive">
              이 채널·업종 조합(
              <span className="font-mono">{conflict.svcCd}</span>)에 이미 등록된
              프롬프트가 {conflict.count}개 있습니다
            </p>
            <p className="text-[11px] text-muted-foreground">
              신규 적용 불가. 다른 채널·업종을 선택하거나
              &apos;프롬프트 관리&apos;에서 기존 프롬프트를 편집해주세요.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() =>
                  selectCompanyForManagement(
                    companySeq.trim(),
                    aiStaffSeq.trim()
                  )
                }
                className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-[11px] font-medium text-destructive transition-smooth hover:bg-destructive/20"
              >
                프롬프트 관리로 이동 →
              </button>
            </div>
          </div>
        </div>
      )}

      <StepNav
        onPrev={goPrev}
        onNext={goNext}
        nextLabel="Next"
        nextDisabled={!canAdvance}
        nextDisabledHint={
          conflict
            ? `이미 등록된 조합(${conflict.svcCd})입니다. 다른 채널·업종을 선택하세요.`
            : "파일 · 채널 · 업종을 모두 입력하세요"
        }
      />
    </div>
  );
}
