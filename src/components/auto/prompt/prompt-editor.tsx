"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import {
  Copy,
  Download,
  RotateCcw,
  Eye,
  EyeOff,
  History,
  ChevronDown,
  ChevronUp,
  Undo2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAutoStore } from "@/stores/auto-store";
import type { ImproveRecord } from "@/stores/auto-store";

function computeChangedLines(
  oldText: string,
  newText: string
): Set<number> {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const changed = new Set<number>();

  const oldLineCounts = new Map<string, number>();
  for (const line of oldLines) {
    oldLineCounts.set(line, (oldLineCounts.get(line) || 0) + 1);
  }

  const consumed = new Map<string, number>();
  const matched = new Array<boolean>(newLines.length).fill(false);
  for (let i = 0; i < newLines.length; i++) {
    const line = newLines[i];
    const available =
      (oldLineCounts.get(line) || 0) - (consumed.get(line) || 0);
    if (available > 0) {
      matched[i] = true;
      consumed.set(line, (consumed.get(line) || 0) + 1);
    }
  }

  for (let i = 0; i < newLines.length; i++) {
    if (!matched[i]) {
      changed.add(i);
    }
  }

  return changed;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function PromptEditor() {
  const {
    editedFullText,
    setEditedFullText,
    generatedPrompt,
    previousPromptText,
    improveHistory,
    parsedTextContent,
    usedImageDescriptions,
  } = useAutoStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showDiff, setShowDiff] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ImproveRecord | null>(
    null
  );

  const changedLines = useMemo(() => {
    if (!previousPromptText || previousPromptText === editedFullText)
      return new Set<number>();
    return computeChangedLines(previousPromptText, editedFullText);
  }, [previousPromptText, editedFullText]);

  const hasChanges = changedLines.size > 0;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editedFullText, isEditing]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedFullText);
    toast.success("클립보드에 복사되었습니다");
  };

  const handleDownload = () => {
    const blob = new Blob([editedFullText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt_${generatedPrompt?.sourceFileName ?? "draft"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("파일이 다운로드되었습니다");
  };

  const handleReset = () => {
    if (generatedPrompt) {
      setEditedFullText(generatedPrompt.fullText);
      toast.info("원래 초안으로 복원되었습니다");
    }
  };

  const handleAcceptChanges = () => {
    useAutoStore.getState().clearPreviousPromptText();
    toast.success("변경 사항이 확정되었습니다");
  };

  const handleRevertTo = (record: ImproveRecord) => {
    useAutoStore.getState().setEditedFullTextWithDiff(record.beforeText);
    toast.info("해당 개선 이전 상태로 복원되었습니다");
    setSelectedRecord(null);
  };

  const lines = editedFullText.split("\n");

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">프롬프트 편집기</h3>
          {generatedPrompt && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {generatedPrompt.type === "hospital" ? "병원" : "일반"}
            </span>
          )}
          {hasChanges && (
            <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
              {changedLines.size}줄 수정됨
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(parsedTextContent.trim() || usedImageDescriptions.length > 0) && (
            <button
              onClick={() => { setShowSource(!showSource); setShowHistory(false); }}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition-smooth",
                showSource
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              소스 데이터
            </button>
          )}
          {improveHistory.length > 0 && (
            <button
              onClick={() => { setShowHistory(!showHistory); setShowSource(false); }}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition-smooth",
                showHistory
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <History className="h-3.5 w-3.5" />
              개선 이력 ({improveHistory.length})
              {showHistory ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
          {hasChanges && (
            <>
              <button
                onClick={() => setShowDiff(!showDiff)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition-smooth",
                  showDiff
                    ? "bg-warning/10 text-warning"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {showDiff ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                변경 표시
              </button>
              <button
                onClick={handleAcceptChanges}
                className="flex h-8 items-center gap-1.5 rounded-md bg-success/10 px-3 text-xs font-medium text-success hover:bg-success/20 transition-smooth"
              >
                확정
              </button>
            </>
          )}
          <button
            onClick={handleReset}
            className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-smooth"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초기화
          </button>
          <button
            onClick={handleCopy}
            className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-smooth"
          >
            <Copy className="h-3.5 w-3.5" />
            복사
          </button>
          <button
            onClick={handleDownload}
            className="flex h-8 items-center gap-1.5 rounded-md bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20 transition-smooth"
          >
            <Download className="h-3.5 w-3.5" />
            다운로드
          </button>
        </div>
      </div>

      {/* Improve History Panel */}
      {showHistory && (
        <div className="border-b border-border bg-muted/30 max-h-64 overflow-y-auto">
          {improveHistory
            .slice()
            .reverse()
            .map((record, idx) => (
              <div
                key={record.id}
                className={cn(
                  "border-b border-border/50 px-4 py-3 transition-smooth cursor-pointer",
                  selectedRecord?.id === record.id
                    ? "bg-primary/5"
                    : "hover:bg-muted/50"
                )}
                onClick={() =>
                  setSelectedRecord(
                    selectedRecord?.id === record.id ? null : record
                  )
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {improveHistory.length - idx}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(record.timestamp)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRevertTo(record);
                    }}
                    className="flex h-6 items-center gap-1 rounded px-2 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
                    title="이 개선 이전으로 되돌리기"
                  >
                    <Undo2 className="h-3 w-3" />
                    되돌리기
                  </button>
                </div>
                <p className="text-xs font-medium text-foreground mb-1 line-clamp-1">
                  {record.feedback}
                </p>
                {selectedRecord?.id === record.id && (
                  <div className="mt-2 rounded-lg border border-border bg-background p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      수정 사항
                    </p>
                    <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                      {record.summary}
                    </pre>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Source Data Panel */}
      {showSource && (
        <div className="border-b border-border bg-muted/30 max-h-72 overflow-y-auto">
          {parsedTextContent.trim() && (
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                엑셀 텍스트 데이터
              </p>
              <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                {parsedTextContent}
              </pre>
            </div>
          )}
          {usedImageDescriptions.map((desc, i) => (
            <div key={i} className="px-4 py-3 border-b border-border/50">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                이미지 분석 결과 #{i + 1}
              </p>
              <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                {desc}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-auto p-4">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editedFullText}
            onChange={(e) => setEditedFullText(e.target.value)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className={cn(
              "w-full resize-none rounded-lg border border-primary bg-background p-4",
              "text-sm leading-relaxed font-mono",
              "focus:outline-none focus:ring-1 focus:ring-primary/50",
              "min-h-[500px]"
            )}
            spellCheck={false}
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="w-full cursor-text rounded-lg border border-border bg-background p-4 min-h-[500px] hover:border-primary/30 transition-smooth"
          >
            {lines.map((line, i) => {
              const isChanged = showDiff && hasChanges && changedLines.has(i);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex text-sm font-mono leading-relaxed",
                    isChanged &&
                      "bg-warning/10 border-l-2 border-warning -ml-2 pl-2 rounded-r-sm"
                  )}
                >
                  <span className="select-none w-10 shrink-0 text-right pr-3 text-muted-foreground/40 text-xs leading-relaxed">
                    {i + 1}
                  </span>
                  <span
                    className={cn(
                      "flex-1 whitespace-pre-wrap break-all",
                      isChanged && "text-warning"
                    )}
                  >
                    {line || "\u00A0"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
