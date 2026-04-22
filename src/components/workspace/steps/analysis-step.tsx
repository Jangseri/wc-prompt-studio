"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { Loader2, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useStructuringStore } from "@/stores/structuring-store";
import type { StructuringPrompt } from "@/types/structuring";

export function AnalysisStep() {
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.aiStaffSeq);
  const sourceFiles = useWorkspaceStore((s) => s.sourceFiles);
  const channel = useWorkspaceStore((s) => s.channel);
  const industry = useWorkspaceStore((s) => s.industry);

  const isParsing = useWorkspaceStore((s) => s.isParsing);
  const parsedText = useWorkspaceStore((s) => s.parsedText);
  const imageDescriptions = useWorkspaceStore((s) => s.imageDescriptions);
  const parseError = useWorkspaceStore((s) => s.parseError);

  const isGenerating = useWorkspaceStore((s) => s.isGenerating);
  const draftGenerated = useWorkspaceStore((s) => s.draftGenerated);
  const generateError = useWorkspaceStore((s) => s.generateError);

  const setParsing = useWorkspaceStore((s) => s.setParsing);
  const setParsedText = useWorkspaceStore((s) => s.setParsedText);
  const setImageDescriptions = useWorkspaceStore((s) => s.setImageDescriptions);
  const setParseError = useWorkspaceStore((s) => s.setParseError);
  const setGenerating = useWorkspaceStore((s) => s.setGenerating);
  const setDraftGenerated = useWorkspaceStore((s) => s.setDraftGenerated);
  const setGenerateError = useWorkspaceStore((s) => s.setGenerateError);
  const goPrev = useWorkspaceStore((s) => s.goPrev);
  const goNext = useWorkspaceStore((s) => s.goNext);

  const setStructuringAll = useStructuringStore((s) => s.setAll);

  const canAnalyze = sourceFiles.length > 0 && !isParsing;
  const canGenerate = !isGenerating && !!channel && !!industry && parsedText.length > 0;
  const canAdvance = draftGenerated && !isGenerating;

  const handleParse = useCallback(async () => {
    setParsing(true);
    setParseError(null);
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
  }, [sourceFiles, setParsing, setParseError, setParsedText, setImageDescriptions]);

  const handleGenerate = useCallback(async () => {
    if (!channel || !industry || !parsedText) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "regions",
          parsedText,
          images: imageDescriptions,
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
    parsedText,
    imageDescriptions,
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">① 파일 분석</h4>
          <button
            type="button"
            onClick={handleParse}
            disabled={!canAnalyze}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary/40 disabled:opacity-50"
          >
            {isParsing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 분석 중…
              </>
            ) : (
              <>분석 실행</>
            )}
          </button>
        </div>

        {parseError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {parseError}
          </p>
        )}

        {parsedText && (
          <div className="rounded-md border border-border/60 bg-card/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> 텍스트 {parsedText.length.toLocaleString()}자
              {imageDescriptions.length > 0 && (
                <>
                  <span className="mx-1">·</span>
                  <ImageIcon className="h-3.5 w-3.5" /> 이미지 {imageDescriptions.length}개
                </>
              )}
            </div>
            <pre className="max-h-40 overflow-auto rounded bg-muted/30 p-2 text-[11px] whitespace-pre-wrap">
              {parsedText.slice(0, 1200)}
              {parsedText.length > 1200 ? "\n…" : ""}
            </pre>
          </div>
        )}
      </div>

      {/* Generate section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">② 프롬프트 초안 생성</h4>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 생성 중…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> 8영역 초안 생성
              </>
            )}
          </button>
        </div>

        {generateError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {generateError}
          </p>
        )}

        {draftGenerated && (
          <p className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary">
            초안이 생성되어 Regions 스텝에 채워졌습니다. 다음 단계에서 편집하세요.
          </p>
        )}
      </div>

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
          다음: 영역 편집 →
        </button>
      </div>
    </div>
  );
}
