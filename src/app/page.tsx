"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Settings2,
  Wrench,
  Check,
  PenLine,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import { useAutoStore } from "@/stores/auto-store";
import { useEditorStore } from "@/stores/editor-store";
import { useUIStore } from "@/stores/ui-store";
import { useCodeNames } from "@/hooks/useCodeNames";
import { useLlmConfig } from "@/hooks/useLlmConfig";
import { useCodeOptions } from "@/hooks/useCodeOptions";
import { fetchKBList } from "@/lib/kb-api";
import Header from "@/components/layout/header";
import FileDropzone from "@/components/auto/upload/file-dropzone";
import UploadProgress from "@/components/auto/upload/upload-progress";
import AutoPromptEditor from "@/components/auto/prompt/prompt-editor";
import ChatWindow from "@/components/auto/chat/chat-window";
import ChatInput from "@/components/auto/chat/chat-input";
import { PromptList } from "@/components/editor/PromptList";
import { PromptEditor as DBPromptEditor } from "@/components/editor/PromptEditor";
import { KBViewer } from "@/components/editor/KBViewer";
import StructuringTab from "@/components/structuring/structuring-tab";

// ─── Upload Step ────────────────────────────────────────────────
function UploadStep() {
  const {
    uploadedFiles,
    detectedType,
    setDetectedType,
    isParsing,
    isGenerating,
    setIsParsing,
    setIsGenerating,
    setGeneratedPrompt,
    setGreetingMessage,
    setCurrentStep,
    parsedTextContent,
    parsedImageDescriptions,
    showParsedReview,
    setParsedTextContent,
    setParsedImageDescriptions,
    setShowParsedReview,
    channelType,
    setChannelType,
    setUsedImageDescriptions,
  } = useAutoStore();

  const [progressSteps, setProgressSteps] = useState<
    { label: string; status: "pending" | "active" | "done" }[]
  >([]);
  const [excludedImageIndices, setExcludedImageIndices] = useState<Set<number>>(new Set());

  const handleUploadAndParse = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("파일을 먼저 업로드해주세요");
      return;
    }

    setIsParsing(true);
    setProgressSteps([
      { label: "파일 업로드 중...", status: "active" },
      { label: "엑셀 텍스트 추출", status: "pending" },
      { label: "이미지 추출 및 분석", status: "pending" },
    ]);

    try {
      const formData = new FormData();
      uploadedFiles.forEach((f) => formData.append("files", f));
      formData.append("type", detectedType);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      const uploadData = await uploadRes.json();

      setProgressSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));

      setParsedTextContent(uploadData.textContent || "");
      setParsedImageDescriptions(uploadData.imageDescriptions || []);
      if (uploadData.detectedType) setDetectedType(uploadData.detectedType);

      setShowParsedReview(true);

      if (uploadData.warnings?.length > 0) {
        uploadData.warnings.forEach((w: string) => toast.warning(w));
      }

      const imgCount = (uploadData.imageDescriptions || []).length;
      const hasUnreadable = JSON.stringify(uploadData.imageDescriptions || []).includes("판독불가");
      if (hasUnreadable) {
        toast.warning("이미지에서 일부 텍스트를 판독할 수 없었습니다. [판독불가] 부분을 확인 후 수정해주세요.");
      } else if (imgCount > 0) {
        toast.success(`파싱 완료! 이미지 ${imgCount}개 분석됨. 결과를 확인해주세요.`);
      } else {
        toast.success("파싱 완료! 결과를 확인해주세요.");
      }
    } catch (err) {
      toast.error("파일 분석 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleGenerateFromReview = async () => {
    setIsGenerating(true);

    try {
      const filteredImages = parsedImageDescriptions.filter((_, i) => !excludedImageIndices.has(i));
      setUsedImageDescriptions(filteredImages);

      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: detectedType,
          textContent: parsedTextContent,
          imageDescriptions: filteredImages,
          channel: channelType,
        }),
      });

      if (!generateRes.ok) throw new Error("Generate failed");

      const generateData = await generateRes.json();

      setGeneratedPrompt({
        id: nanoid(),
        fullText: generateData.prompt,
        sections: generateData.sections,
        type: detectedType,
        createdAt: new Date().toISOString(),
        sourceFileName: uploadedFiles[0]?.name ?? "unknown",
      });

      if (generateData.greetingMessage) {
        setGreetingMessage(generateData.greetingMessage);
      }

      const warnings = generateData.warnings || [];
      if (warnings.length > 0) {
        toast.warning(`검증 경고 ${warnings.length}건: ${warnings[0]}`);
      }

      toast.success("프롬프트 초안이 생성되었습니다!");
      setShowParsedReview(false);
      setCurrentStep("edit");
    } catch (err) {
      toast.error("프롬프트 생성 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center">
        <h2 className="mb-2 text-2xl font-bold">소스 파일 업로드</h2>
        <p className="text-sm text-muted-foreground">
          고객사에서 받은 엑셀 또는 플로우차트 이미지를 업로드하세요
        </p>
      </div>

      {!showParsedReview && (
        <>
          <FileDropzone />

          {uploadedFiles.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div>
                <p className="mb-3 text-sm font-medium">채널 선택</p>
                <div className="flex gap-3">
                  {(["callbot", "chatbot"] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setChannelType(ch)}
                      className={cn(
                        "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-smooth",
                        channelType === ch
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {ch === "callbot" ? "콜봇 (음성)" : "챗봇 (텍스트)"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-medium">업종 선택</p>
                <div className="flex gap-3">
                  {(["hospital", "general"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setDetectedType(type)}
                      className={cn(
                        "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-smooth",
                        detectedType === type
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {type === "hospital" ? "병원 계열" : "일반 계열"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isParsing && <UploadProgress steps={progressSteps} />}

          {uploadedFiles.length > 0 && !isParsing && (
            <button
              onClick={handleUploadAndParse}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-smooth glow-primary"
            >
              <Sparkles className="h-5 w-5" />
              파일 분석하기
            </button>
          )}

          {isParsing && (
            <button
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/50 px-6 py-4 text-sm font-semibold text-primary-foreground cursor-not-allowed"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
              파일 분석 중...
            </button>
          )}

          {/* 직접 입력 진입 */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-background px-3 text-xs text-muted-foreground">또는</span>
          </div>
          <button
            onClick={() => {
              setParsedTextContent("");
              setParsedImageDescriptions([]);
              setShowParsedReview(true);
            }}
            disabled={isParsing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-6 py-4 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground transition-smooth"
          >
            <PenLine className="h-4 w-4" />
            파일 없이 직접 입력하기
          </button>
        </>
      )}

      {showParsedReview && (
        <div className="space-y-4">
          {/* 안내 메시지 */}
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm font-semibold text-warning mb-1">
              {parsedTextContent.trim() || parsedImageDescriptions.length > 0
                ? "파싱 결과를 확인하세요"
                : "소스 데이터를 직접 입력하세요"}
            </p>
            <p className="text-xs text-muted-foreground">
              {parsedTextContent.trim() || parsedImageDescriptions.length > 0
                ? "필요 없는 데이터는 제외하고, 잘못된 부분을 수정한 후 프롬프트를 생성하세요."
                : "고객사에서 받은 정보를 아래 텍스트 영역에 직접 붙여넣거나 입력하세요."}
            </p>
          </div>

          {/* 채널 / 업종 선택 (직접 입력 모드에서도 표시) */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div>
              <p className="mb-3 text-sm font-medium">채널 선택</p>
              <div className="flex gap-3">
                {(["callbot", "chatbot"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setChannelType(ch)}
                    className={cn(
                      "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-smooth",
                      channelType === ch
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {ch === "callbot" ? "콜봇 (음성)" : "챗봇 (텍스트)"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium">업종 선택</p>
              <div className="flex gap-3">
                {(["hospital", "general"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDetectedType(type)}
                    className={cn(
                      "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-smooth",
                      detectedType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {type === "hospital" ? "병원 계열" : "일반 계열"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 엑셀 텍스트 데이터 — 제외 버튼 포함 */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {parsedTextContent.trim() ? "엑셀 텍스트 데이터" : "소스 텍스트 데이터"}
              </h3>
              {parsedTextContent.trim() && (
                <button
                  onClick={() => setParsedTextContent("")}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  제외
                </button>
              )}
            </div>
            <textarea
              value={parsedTextContent}
              onChange={(e) => setParsedTextContent(e.target.value)}
              placeholder="고객사에서 받은 텍스트 데이터를 여기에 붙여넣으세요..."
              className="w-full bg-background p-4 text-sm font-mono leading-relaxed focus:outline-none resize-none min-h-[150px]"
              spellCheck={false}
            />
          </div>

          {/* 이미지 분석 결과 — 개별 제외 토글 */}
          {parsedImageDescriptions.map((desc, i) => {
            const isExcluded = excludedImageIndices.has(i);
            return (
              <div key={i} className={cn(
                "rounded-xl border bg-card overflow-hidden transition-smooth",
                isExcluded ? "border-border/50 opacity-50" : "border-border"
              )}>
                <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                  <h3 className={cn("text-sm font-semibold", isExcluded && "line-through text-muted-foreground")}>
                    이미지 분석 결과 #{i + 1}
                  </h3>
                  <div className="flex items-center gap-2">
                    {!isExcluded && desc.includes("판독불가") && (
                      <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                        판독불가 항목 있음
                      </span>
                    )}
                    <button
                      onClick={() => {
                        const next = new Set(excludedImageIndices);
                        if (isExcluded) next.delete(i); else next.add(i);
                        setExcludedImageIndices(next);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-smooth",
                        isExcluded
                          ? "text-primary hover:bg-primary/10"
                          : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      )}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      {isExcluded ? "포함" : "제외"}
                    </button>
                  </div>
                </div>
                {!isExcluded && (
                  <textarea
                    value={desc}
                    onChange={(e) => {
                      const updated = [...parsedImageDescriptions];
                      updated[i] = e.target.value;
                      setParsedImageDescriptions(updated);
                    }}
                    className="w-full bg-background p-4 text-sm font-mono leading-relaxed focus:outline-none resize-none min-h-[300px]"
                    spellCheck={false}
                  />
                )}
              </div>
            );
          })}

          {/* 하단 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowParsedReview(false)}
              className="flex-1 rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-muted transition-smooth"
            >
              뒤로
            </button>
            <button
              onClick={handleGenerateFromReview}
              disabled={isGenerating || !parsedTextContent.trim()}
              className={cn(
                "flex-[2] flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-smooth",
                isGenerating || !parsedTextContent.trim()
                  ? "bg-primary/50 text-primary-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
              )}
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> 프롬프트 생성 중...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> 프롬프트 초안 생성하기</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Edit Step ──────────────────────────────────────────────────
function EditStep() {
  return (
    <div className="mx-auto h-[calc(100vh-10rem)] max-w-5xl">
      <div className="h-full rounded-xl border border-border bg-card overflow-hidden">
        <AutoPromptEditor />
      </div>
    </div>
  );
}

// ─── Chat Step ──────────────────────────────────────────────────
function ChatStep() {
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isImproving, setIsImproving] = useState(false);
  const [improveSummary, setImproveSummary] = useState("");
  const {
    dummyData,
    setDummyData,
    chatSettings,
    setChatSettings,
    initChat,
    chatMessages,
    editedFullText,
    setEditedFullTextWithDiff,
    setCurrentStep,
    addImproveRecord,
  } = useAutoStore();

  useEffect(() => {
    if (chatMessages.length === 0) {
      initChat();
    }
  }, []);

  const handleImprove = async () => {
    if (!feedbackText.trim()) {
      toast.error("개선 요청 내용을 입력해주세요");
      return;
    }

    setIsImproving(true);
    setImproveSummary("");

    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPrompt: editedFullText,
          chatHistory: chatMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          feedback: feedbackText,
        }),
      });

      if (!res.ok) throw new Error("Improve failed");

      const data = await res.json();

      const trimmedOld = editedFullText.trim();
      const trimmedNew = data.improvedPrompt.trim();

      if (trimmedOld === trimmedNew) {
        setImproveSummary("변경 사항이 없습니다. 피드백을 더 구체적으로 작성해보세요.");
        toast.warning("프롬프트가 변경되지 않았습니다.");
        return;
      }

      addImproveRecord({
        id: nanoid(),
        timestamp: new Date().toISOString(),
        feedback: feedbackText,
        summary: data.summary || "프롬프트가 수정되었습니다.",
        beforeText: editedFullText,
        afterText: data.improvedPrompt,
      });
      setEditedFullTextWithDiff(data.improvedPrompt);
      setImproveSummary(data.summary || "프롬프트가 수정되었습니다.");
      toast.success("프롬프트가 개선되었습니다!");
      setCurrentStep("edit");
    } catch {
      toast.error("프롬프트 개선 중 오류가 발생했습니다.");
    } finally {
      setIsImproving(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-5xl gap-4">
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">대화 테스트</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowFeedback(!showFeedback); setShowSettings(false); }}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition-smooth",
                showFeedback
                  ? "bg-warning/10 text-warning"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Wrench className="h-3.5 w-3.5" />
              프롬프트 개선
            </button>
            <button
              onClick={() => { setShowSettings(!showSettings); setShowFeedback(false); }}
              className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-smooth"
            >
              <Settings2 className="h-3.5 w-3.5" />
              설정
              {showSettings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {showFeedback && (
          <div className="border-b border-border bg-warning/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-warning">
              대화에서 발견한 문제를 설명하면 프롬프트를 자동 개선합니다
            </p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={'예: "기차"라고 말하면 STT 오류로 "기타"로 해석해야 하는데, 문맥 보정을 안 해줍니다.'}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-warning focus:outline-none resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleImprove}
                disabled={isImproving || !feedbackText.trim()}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md px-4 text-xs font-medium transition-smooth",
                  isImproving || !feedbackText.trim()
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-warning text-background hover:bg-warning/80"
                )}
              >
                {isImproving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 개선 중...</>
                ) : (
                  <><Wrench className="h-3.5 w-3.5" /> 프롬프트 개선 적용</>
                )}
              </button>
              {improveSummary && (
                <button
                  onClick={() => setCurrentStep("edit")}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20 transition-smooth"
                >
                  <Check className="h-3.5 w-3.5" />
                  편집 탭에서 확인
                </button>
              )}
            </div>
            {improveSummary && (
              <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2.5 space-y-1">
                <p className="text-xs font-semibold text-success">수정 사항:</p>
                <pre className="text-xs text-success/90 whitespace-pre-wrap font-sans leading-relaxed">
                  {improveSummary}
                </pre>
              </div>
            )}
          </div>
        )}

        {showSettings && (
          <div className="border-b border-border bg-muted/50 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Temperature</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={chatSettings.temperature}
                  onChange={(e) => setChatSettings({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-primary"
                />
                <span className="text-xs text-muted-foreground">{chatSettings.temperature}</span>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Max Tokens</label>
                <input
                  type="number"
                  value={chatSettings.maxTokens}
                  onChange={(e) => setChatSettings({ maxTokens: parseInt(e.target.value) || 1024 })}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">AA코드 테스트 데이터</p>
              {(
                [
                  ["aa2001", "AA2001 (업체정보)"],
                  ["aa2002", "AA2002 (고객정보)"],
                  ["aa2003", "AA2003 (영업상태)"],
                  ["aa1000", "AA1000 (참고자료)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
                  <textarea
                    value={dummyData[key]}
                    onChange={(e) => setDummyData({ [key]: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <ChatWindow />
        <ChatInput />
      </div>
    </div>
  );
}

// ─── Auto Tab ───────────────────────────────────────────────────
function AutoTab() {
  const { currentStep } = useAutoStore();

  return (
    <main className="p-6">
      {currentStep === "upload" && <UploadStep />}
      {currentStep === "edit" && <EditStep />}
      {currentStep === "chat" && <ChatStep />}
    </main>
  );
}

// ─── Editor Tab ─────────────────────────────────────────────────
function EditorTab() {
  const {
    items,
    selectedItem,
    loading,
    isCreateMode,
    searchedCompanySeq,
    activeTab,
    kbItems,
    selectedKB,
    kbLoading,
    setItems,
    setSelectedItem,
    setLoading,
    setIsCreateMode,
    setSearchedCompanySeq,
    setActiveTab,
    setKbItems,
    setSelectedKB,
    setKbLoading,
    setDbConnected,
    setDbReason,
    handleSelect,
    handleCreate,
    handleCreated,
    handleSaved,
    handleDeleted,
    handleReset,
  } = useEditorStore();

  const { codeNames } = useCodeNames();
  const { llmConfigMap } = useLlmConfig();
  const { svcGroups, prmtGroups } = useCodeOptions();

  // Health check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch("/api/health", { signal: controller.signal });
        clearTimeout(timer);
        const data = await res.json();
        setDbConnected(data.connected);
        setDbReason(data.reason ?? null);
      } catch {
        setDbConnected(false);
        setDbReason("서버 응답 없음");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [setDbConnected, setDbReason]);

  const fetchKB = useCallback(
    async (companySeq: string) => {
      setKbLoading(true);
      try {
        const data = await fetchKBList(companySeq);
        setKbItems(data);
        setSelectedKB(null);
      } catch (err) {
        setKbItems([]);
        toast.error(err instanceof Error ? err.message : "KB 목록을 불러올 수 없습니다");
      } finally {
        setKbLoading(false);
      }
    },
    [setKbItems, setSelectedKB, setKbLoading]
  );

  const handleSearch = useCallback(
    async (companySeq: string) => {
      setLoading(true);
      setIsCreateMode(false);
      setSearchedCompanySeq(companySeq);
      try {
        const params = companySeq ? `?company_seq=${encodeURIComponent(companySeq)}` : "";
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(`/api/prompts${params}`, { signal: controller.signal });
        clearTimeout(timer);
        const data = await res.json();
        if (data.success) {
          setItems(data.data);
          setSelectedItem(null);
        } else {
          toast.error(data.error || "검색 실패");
        }
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === "AbortError"
            ? "검색 요청 시간이 초과되었습니다"
            : "네트워크 오류로 검색할 수 없습니다";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
      fetchKB(companySeq);
    },
    [fetchKB, setLoading, setIsCreateMode, setSearchedCompanySeq, setItems, setSelectedItem]
  );

  return (
    <div className="flex flex-1 min-h-0">
      <PromptList
        items={items}
        selectedId={selectedItem?.cstm_id ?? null}
        onSelect={handleSelect}
        onSearch={handleSearch}
        onReset={handleReset}
        onCreate={searchedCompanySeq ? handleCreate : undefined}
        loading={loading}
        codeNames={codeNames}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        kbItems={kbItems}
        selectedKBId={selectedKB?.file_name ?? null}
        onSelectKB={setSelectedKB}
        kbLoading={kbLoading}
      />
      {activeTab === "prompt" ? (
        <DBPromptEditor
          item={selectedItem}
          isCreateMode={isCreateMode}
          defaultCompanySeq={searchedCompanySeq}
          onSaved={handleSaved}
          onCreated={handleCreated}
          onDeleted={handleDeleted}
          codeNames={codeNames}
          llmConfigMap={llmConfigMap}
          svcGroups={svcGroups}
          prmtGroups={prmtGroups}
        />
      ) : (
        <KBViewer item={selectedKB} />
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function HomePage() {
  const { activeMainTab } = useUIStore();

  return (
    <div className="h-screen flex flex-col">
      <Header />
      {activeMainTab === "auto" && <AutoTab />}
      {activeMainTab === "structuring" && <StructuringTab />}
      {activeMainTab === "editor" && <EditorTab />}
    </div>
  );
}
