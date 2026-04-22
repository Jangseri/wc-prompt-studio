"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Check,
  Maximize2,
  Minimize2,
  FileText,
  MessageSquare,
  Settings2,
  RotateCcw,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStructuringStore } from "@/stores/structuring-store";
import { TARGET_LLM_META, type TargetLLM } from "@/types/structuring";
import { assemblePrompt } from "./lib/assemble-prompt";
import { ChatWindow } from "./chat/chat-window";
import { ChatInput } from "./chat/chat-input";
import { ChatSettings } from "./chat/chat-settings";

const TARGETS: TargetLLM[] = ["gpt", "claude", "gemini"];

function PreviewView({ inModal }: { inModal: boolean }) {
  const prompt = useStructuringStore((s) => s.prompt);
  const targetLLM = useStructuringStore((s) => s.targetLLM);

  const rendered = useMemo(() => assemblePrompt(prompt, targetLLM), [prompt, targetLLM]);
  const isEmpty = rendered.trim().length === 0;

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      {isEmpty ? (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <p className="text-xs text-muted-foreground">
            영역을 작성하면 여기에 실시간으로 조립된 프롬프트가 표시됩니다.
          </p>
        </div>
      ) : (
        <pre
          className={cn(
            "p-4 font-mono leading-relaxed whitespace-pre-wrap break-words",
            inModal ? "text-base" : "text-sm"
          )}
        >
          {rendered}
        </pre>
      )}
    </div>
  );
}

function ChatView() {
  const initChat = useStructuringStore((s) => s.initChat);
  const chatMessagesLength = useStructuringStore((s) => s.chatMessages.length);
  const targetLLM = useStructuringStore((s) => s.targetLLM);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (chatMessagesLength === 0) initChat();
  }, [initChat, chatMessagesLength]);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {targetLLM !== "gpt" && (
        <div className="border-b border-warning/30 bg-warning/5 px-4 py-2">
          <p className="text-[11px] text-warning">
            ℹ️ 현재 <strong>{TARGET_LLM_META[targetLLM].label}</strong> 포맷으로 조립되지만,
            실제 응답은 ChatGPT(gpt-4o) 기반으로 생성됩니다.
          </p>
        </div>
      )}
      {showSettings && <ChatSettings />}
      <div className="flex flex-1 min-h-0 flex-col">
        <div className="flex items-center justify-end gap-1 border-b border-border px-3 py-1.5">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-smooth",
              showSettings
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings2 className="h-3 w-3" />
            설정
            {showSettings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
        <ChatWindow />
        <ChatInput />
      </div>
    </div>
  );
}

export function PreviewPanel() {
  const targetLLM = useStructuringStore((s) => s.targetLLM);
  const setTargetLLM = useStructuringStore((s) => s.setTargetLLM);
  const rightPanelView = useStructuringStore((s) => s.rightPanelView);
  const setRightPanelView = useStructuringStore((s) => s.setRightPanelView);
  const clearChat = useStructuringStore((s) => s.clearChat);
  const prompt = useStructuringStore((s) => s.prompt);

  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const rendered = useMemo(() => assemblePrompt(prompt, targetLLM), [prompt, targetLLM]);
  const isPromptEmpty = rendered.trim().length === 0;

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  const handleCopy = async () => {
    if (isPromptEmpty) {
      toast.info("먼저 영역을 작성해주세요");
      return;
    }
    try {
      await navigator.clipboard.writeText(rendered);
      setCopied(true);
      toast.success("클립보드에 복사되었습니다");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사에 실패했습니다");
    }
  };

  const renderHeader = (inModal: boolean) => (
    <div className="border-b border-border px-4 py-3 space-y-3 shrink-0">
      {/* Row 1: View toggle + action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-md bg-muted p-0.5">
          <button
            onClick={() => setRightPanelView("preview")}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-smooth",
              rightPanelView === "preview"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            onClick={() => setRightPanelView("chat")}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-smooth",
              rightPanelView === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </button>
        </div>

        <div className="flex items-center gap-1">
          {rightPanelView === "preview" ? (
            <>
              <button
                onClick={() => setFullscreen((v) => !v)}
                title={inModal ? "창 닫기 (ESC)" : "전체화면으로 보기"}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-smooth"
              >
                {inModal ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-smooth",
                  copied
                    ? "bg-success/10 text-success"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    복사
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={clearChat}
              title="대화 초기화"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              초기화
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Target LLM */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Target LLM:</span>
        <div className="flex gap-1">
          {TARGETS.map((t) => (
            <button
              key={t}
              onClick={() => setTargetLLM(t)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-smooth",
                targetLLM === t
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {TARGET_LLM_META[t].label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {TARGET_LLM_META[targetLLM].formatName}
        </span>
      </div>
    </div>
  );

  if (fullscreen && rightPanelView === "preview") {
    return (
      <>
        <div className="flex h-full flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-center p-6 text-center">
            <p className="text-xs text-muted-foreground">
              전체화면 창에서 보고 있습니다.
            </p>
          </div>
        </div>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 md:p-8">
          <div
            className="absolute inset-0"
            onClick={() => setFullscreen(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-6xl flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            {renderHeader(true)}
            <PreviewView inModal />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card overflow-hidden">
      {renderHeader(false)}
      {rightPanelView === "preview" ? <PreviewView inModal={false} /> : <ChatView />}
    </div>
  );
}
