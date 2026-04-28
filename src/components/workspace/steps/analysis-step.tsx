"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  EyeOff,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useStructuringStore } from "@/stores/structuring-store";
import { StepNav } from "../step-nav";
import type { StructuringPrompt } from "@/types/structuring";

const PRIMARY_PILL_BTN =
  "group inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2 text-sm font-medium shadow-sm transition-all " +
  "bg-primary text-primary-foreground " +
  "hover:bg-primary/90 hover:shadow-md hover:-translate-y-[1px] " +
  "active:translate-y-0 active:shadow-sm " +
  "disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:shadow-none disabled:hover:bg-muted disabled:hover:translate-y-0 disabled:cursor-not-allowed";

export function AnalysisStep() {
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.aiStaffSeq);
  const sourceFiles = useWorkspaceStore((s) => s.sourceFiles);
  const channel = useWorkspaceStore((s) => s.channel);
  const industry = useWorkspaceStore((s) => s.industry);

  const isParsing = useWorkspaceStore((s) => s.isParsing);
  const parsedText = useWorkspaceStore((s) => s.parsedText);
  const textExcluded = useWorkspaceStore((s) => s.textExcluded);
  const imageDescriptions = useWorkspaceStore((s) => s.imageDescriptions);
  const excludedImageIndices = useWorkspaceStore((s) => s.excludedImageIndices);
  const parseError = useWorkspaceStore((s) => s.parseError);

  const isGenerating = useWorkspaceStore((s) => s.isGenerating);
  const draftGenerated = useWorkspaceStore((s) => s.draftGenerated);
  const generateError = useWorkspaceStore((s) => s.generateError);

  const setParsing = useWorkspaceStore((s) => s.setParsing);
  const setParsedText = useWorkspaceStore((s) => s.setParsedText);
  const setTextExcluded = useWorkspaceStore((s) => s.setTextExcluded);
  const setImageDescriptions = useWorkspaceStore((s) => s.setImageDescriptions);
  const setImageDescriptionAt = useWorkspaceStore((s) => s.setImageDescriptionAt);
  const toggleExcludedImage = useWorkspaceStore((s) => s.toggleExcludedImage);
  const setParseError = useWorkspaceStore((s) => s.setParseError);
  const setGenerating = useWorkspaceStore((s) => s.setGenerating);
  const setDraftGenerated = useWorkspaceStore((s) => s.setDraftGenerated);
  const setGenerateError = useWorkspaceStore((s) => s.setGenerateError);
  const goPrev = useWorkspaceStore((s) => s.goPrev);
  const goNext = useWorkspaceStore((s) => s.goNext);

  const setStructuringAll = useStructuringStore((s) => s.setAll);

  const canAnalyze = sourceFiles.length > 0 && !isParsing;
  const effectiveText = textExcluded ? "" : parsedText;
  const includedImages = imageDescriptions.filter(
    (_, i) => !excludedImageIndices.includes(i)
  );
  const hasInput = effectiveText.length > 0 || includedImages.length > 0;
  // Image-only uploads (or text-empty xlsx) leave parsedText === "" yet
  // still produce imageDescriptions. Use this combined signal anywhere
  // we want to mean "analysis has run and produced something".
  const hasAnalyzed = parsedText.length > 0 || imageDescriptions.length > 0;
  // Once a draft is generated, the generate button is disabled so users
  // don't accidentally trigger a second (paid) LLM call. Re-generation
  // requires re-analyzing the source file first (which resets draft).
  const canGenerate =
    !isGenerating && !!channel && !!industry && hasInput && !draftGenerated;
  const canAdvance = draftGenerated && !isGenerating;

  const handleParse = useCallback(async () => {
    setParsing(true);
    setParseError(null);
    // Re-analyzing resets the draft so the generate button becomes
    // available again for a fresh generation against the new text.
    setDraftGenerated(false);
    setGenerateError(null);
    // A fresh parse starts from "include everything" — old exclusions
    // from a prior run would be confusing.
    setTextExcluded(false);
    try {
      const formData = new FormData();
      sourceFiles.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        throw new Error(`업로드 실패 (HTTP ${res.status})`);
      }
      const data = await res.json();
      setParsedText(data.textContent ?? data.parsedText ?? "");
      setImageDescriptions(data.imageDescriptions ?? []);
      toast.success("파일 분석 완료");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseError(msg);
      toast.error(`분석 실패: ${msg}`);
    } finally {
      setParsing(false);
    }
  }, [
    sourceFiles,
    setParsing,
    setParseError,
    setParsedText,
    setImageDescriptions,
    setDraftGenerated,
    setGenerateError,
    setTextExcluded,
  ]);

  const handleGenerate = useCallback(async () => {
    if (!channel || !industry || !hasInput) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "regions",
          parsedText: effectiveText,
          images: includedImages,
          channel,
          industry,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      if (!data.structuring) {
        throw new Error("응답에 structuring이 없습니다");
      }
      setStructuringAll(data.structuring as StructuringPrompt);
      setDraftGenerated(true);
      toast.success("초안 생성 완료 — 영역이 자동으로 채워졌습니다");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenerateError(msg);
      toast.error(`생성 실패: ${msg}`);
    } finally {
      setGenerating(false);
    }
  }, [
    channel,
    industry,
    hasInput,
    effectiveText,
    includedImages,
    setGenerating,
    setGenerateError,
    setStructuringAll,
    setDraftGenerated,
  ]);

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
        <span className="font-medium">대상: </span>
        {companySeq || "–"} / {aiStaffSeq || "–"} · {channel ?? "–"} · {industry || "–"} ·{" "}
        {sourceFiles.length}개 파일
      </div>

      {/* Parse section */}
      <div className="space-y-3">
        {!hasAnalyzed ? (
          <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold">① 파일 분석</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {sourceFiles.length === 0
                  ? "Source 스텝에서 파일을 먼저 업로드하세요"
                  : `엑셀 텍스트와 이미지를 추출합니다 · ${sourceFiles.length}개 파일`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleParse}
              disabled={!canAnalyze}
              title={
                sourceFiles.length === 0
                  ? "Source 스텝에서 파일을 업로드하세요"
                  : undefined
              }
              className={PRIMARY_PILL_BTN}
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  분석 중…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  분석 실행
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <h4 className="text-sm font-semibold">① 파일 분석 완료</h4>
            <span className="text-xs text-muted-foreground">
              {parsedText.length > 0 && (
                <>· {parsedText.length.toLocaleString()}자</>
              )}
              {imageDescriptions.length > 0 &&
                ` · 이미지 ${imageDescriptions.length}개`}
            </span>
            <button
              type="button"
              onClick={handleParse}
              disabled={!canAnalyze}
              className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {isParsing ? "분석 중…" : "재분석"}
            </button>
          </div>
        )}

        {parseError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {parseError}
          </p>
        )}

        {hasAnalyzed && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {parsedText.length > 0 && (
                <>
                  <FileText className="h-3.5 w-3.5" /> 텍스트{" "}
                  {parsedText.length.toLocaleString()}자
                </>
              )}
              {imageDescriptions.length > 0 && (
                <>
                  {parsedText.length > 0 && <span className="mx-1">·</span>}
                  <ImageIcon className="h-3.5 w-3.5" /> 이미지{" "}
                  {imageDescriptions.length - excludedImageIndices.length}/
                  {imageDescriptions.length}개 포함
                </>
              )}
              {(textExcluded || excludedImageIndices.length > 0) && (
                <span className="ml-auto text-[10px] text-amber-500">
                  제외된 데이터는 초안 생성에서 빠집니다
                </span>
              )}
            </div>

            {/* Excel text — editable, non-destructive exclude */}
            {parsedText.length > 0 && (
            <div
              className={cn(
                "rounded-md border bg-card/40 overflow-hidden transition-smooth",
                textExcluded ? "border-border/40 opacity-60" : "border-border/60"
              )}
            >
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
                <p
                  className={cn(
                    "text-[11px] font-medium",
                    textExcluded
                      ? "text-muted-foreground line-through"
                      : "text-foreground/80"
                  )}
                >
                  엑셀 텍스트
                </p>
                <button
                  type="button"
                  onClick={() => setTextExcluded(!textExcluded)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] transition-smooth",
                    textExcluded
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  )}
                >
                  {textExcluded ? (
                    <>
                      <Eye className="h-3 w-3" /> 포함
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" /> 제외
                    </>
                  )}
                </button>
              </div>
              {!textExcluded && (
                <textarea
                  value={parsedText}
                  onChange={(e) => setParsedText(e.target.value)}
                  spellCheck={false}
                  className="block h-[40vh] w-full resize-y bg-transparent p-3 font-mono text-[11px] leading-relaxed outline-none focus:bg-muted/10"
                />
              )}
            </div>
            )}

            {/* Image descriptions — editable, per-image toggle */}
            {imageDescriptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  이미지 분석 ({imageDescriptions.length}개)
                </p>
                {imageDescriptions.map((desc, idx) => {
                  const isExcluded = excludedImageIndices.includes(idx);
                  const hasUnreadable = desc.includes("판독불가");
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-md border bg-card/40 overflow-hidden transition-smooth",
                        isExcluded
                          ? "border-border/40 opacity-60"
                          : "border-border/60"
                      )}
                    >
                      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <p
                            className={cn(
                              "text-[11px] font-medium",
                              isExcluded
                                ? "text-muted-foreground line-through"
                                : "text-foreground/80"
                            )}
                          >
                            이미지 {idx + 1}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            · {desc.length.toLocaleString()}자
                          </span>
                          {!isExcluded && hasUnreadable && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              판독불가 있음
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExcludedImage(idx)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] transition-smooth",
                            isExcluded
                              ? "text-primary hover:bg-primary/10"
                              : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          )}
                        >
                          {isExcluded ? (
                            <>
                              <Eye className="h-3 w-3" /> 포함
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" /> 제외
                            </>
                          )}
                        </button>
                      </div>
                      {!isExcluded && (
                        <textarea
                          value={desc}
                          onChange={(e) =>
                            setImageDescriptionAt(idx, e.target.value)
                          }
                          spellCheck={false}
                          className="block h-[28vh] w-full resize-y bg-transparent p-3 font-mono text-[11px] leading-relaxed outline-none focus:bg-muted/10"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generate section */}
      <div className="space-y-3">
        {!draftGenerated ? (
          <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold">② 프롬프트 초안 생성</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {!hasAnalyzed
                  ? "먼저 ①에서 파일 분석을 실행하세요"
                  : !channel || !industry
                    ? "Source 스텝에서 채널·업종을 입력하세요"
                    : !hasInput
                      ? "텍스트와 이미지가 모두 제외되었습니다. 하나 이상 포함시키세요"
                      : "분석된 내용으로 전체 구성 초안을 한 번에 생성합니다"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              title={
                !hasAnalyzed
                  ? "먼저 파일 분석을 실행하세요"
                  : !channel || !industry
                    ? "Source 스텝에서 채널·업종을 선택하세요"
                    : !hasInput
                      ? "텍스트·이미지 중 하나 이상을 포함시켜야 합니다"
                      : undefined
              }
              className={PRIMARY_PILL_BTN}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  생성 중…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  초안 생성
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              초안이 생성되어 Regions 스텝에 채워졌습니다. 다음 단계에서 편집하세요.
            </span>
          </div>
        )}

        {generateError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {generateError}
          </p>
        )}
      </div>

      <StepNav
        onPrev={goPrev}
        onNext={goNext}
        nextLabel="Regions"
        nextDisabled={!canAdvance}
        nextDisabledHint="파일 분석과 초안 생성을 먼저 완료하세요"
      />
    </div>
  );
}
