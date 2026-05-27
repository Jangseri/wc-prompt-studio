"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Check,
  FileText,
  Loader2,
  MessageSquare,
  Database,
  Maximize2,
  X,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStructuringStore } from "@/stores/structuring-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { assemblePrompt } from "@/components/structuring/lib/assemble-prompt";
import { ChatWindow } from "@/components/structuring/chat/chat-window";
import { ChatInput } from "@/components/structuring/chat/chat-input";
import { KBViewer } from "@/components/editor/KBViewer";
import { fetchKBList } from "@/lib/kb-api";
import { TARGET_LLM_META, type TargetLLM } from "@/types/structuring";
import type { KBItem } from "@/types/editor";
import { ExistingCompanyChatTab } from "./existing-company-chat-tab";

const LLM_TARGETS: TargetLLM[] = ["gpt", "claude", "gemini"];

type RightTab = "preview" | "chat" | "kb";

const TABS: { id: RightTab; label: string; icon: typeof FileText }[] = [
  { id: "preview", label: "Preview", icon: FileText },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "kb", label: "KB", icon: Database },
];

export function PreviewChatPanel() {
  const mode = useWorkspaceStore((s) => s.mode);
  const [active, setActive] = useState<RightTab>("preview");

  // Tabs visible in the tabbed layout. Workflow mode hides KB
  // (the draft doesn't need the reference library); manage mode is
  // handled separately below (KB-only, no tab bar).
  const visibleTabs = useMemo(
    () =>
      mode === "workflow" ? TABS.filter((t) => t.id !== "kb") : TABS,
    [mode]
  );

  // If the currently-active tab got filtered out by a mode change,
  // snap back to the first available one.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === active)) {
      setActive(visibleTabs[0]?.id ?? "preview");
    }
  }, [visibleTabs, active]);

  // manage 모드 전용 탭. Preview/일반 Chat 탭은 region 편집 상태에 묶여
  // 있어서 기존 회사 화면에서 보여주면 혼란을 주므로 제외. 대신 저장된
  // PD2000/PD0000 으로 바로 테스트할 수 있는 ExistingCompanyChatTab 과
  // 기존 KBTab 을 좌우 탭으로 노출.
  if (mode === "manage") {
    const manageTabs = [
      { id: "manage-chat" as const, label: "Chat", icon: MessageSquare },
      { id: "manage-kb" as const, label: "KB", icon: Database },
    ];
    return <ManageTabs tabs={manageTabs} />;
  }

  return (
    <div className="flex h-full flex-col gap-3 min-h-0">
      <div className="flex items-center gap-1 rounded-md border border-border/50 p-1">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-smooth",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0">
        {active === "preview" && <PreviewTab />}
        {active === "chat" && <ChatTab />}
        {active === "kb" && <KBTab />}
      </div>
    </div>
  );
}

/**
 * manage 모드 우측 패널의 탭 컨테이너. workflow 모드의 탭 바 스타일을
 * 그대로 따르되, 탭 종류만 [Chat | KB] 로 한정. 기본은 Chat 탭 (사용자가
 * 새로 추가한 기능이므로 진입 시 바로 보이게).
 */
function ManageTabs({
  tabs,
}: {
  tabs: { id: "manage-chat" | "manage-kb"; label: string; icon: typeof FileText }[];
}) {
  const [active, setActive] = useState<"manage-chat" | "manage-kb">("manage-chat");
  return (
    <div className="flex h-full flex-col gap-3 min-h-0">
      <div className="flex items-center gap-1 rounded-md border border-border/50 p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-smooth",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0">
        {active === "manage-chat" && <ExistingCompanyChatTab />}
        {active === "manage-kb" && <KBTab />}
      </div>
    </div>
  );
}

function PreviewTab() {
  // Regions 의 라이브 편집 상태가 아니라 "적용" 으로 publish 된
  // 스냅샷을 읽는다. 사용자가 적용 버튼을 누르기 전까진 미반영.
  const prompt = useStructuringStore((s) => s.publishedPrompt);
  const targetLLM = useStructuringStore((s) => s.targetLLM);
  const setTargetLLM = useStructuringStore((s) => s.setTargetLLM);
  const [copied, setCopied] = useState(false);

  const assembled = useMemo(() => assemblePrompt(prompt, targetLLM), [prompt, targetLLM]);
  const isEmpty = assembled.trim().length === 0;

  const handleCopy = useCallback(async () => {
    if (isEmpty) return;
    try {
      await navigator.clipboard.writeText(assembled);
      setCopied(true);
      toast.success("프롬프트 복사됨");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사에 실패했습니다");
    }
  }, [assembled, isEmpty]);

  return (
    <div className="flex h-full flex-col min-h-0 gap-2">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[11px] text-muted-foreground">Target LLM:</span>
        <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
          {LLM_TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTargetLLM(t)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-medium transition-smooth",
                targetLLM === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {TARGET_LLM_META[t].label}
            </button>
          ))}
        </div>
        <span className="truncate text-[10px] text-muted-foreground">
          {TARGET_LLM_META[targetLLM].formatName}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          disabled={isEmpty}
          className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "복사됨" : "복사"}
        </button>
      </div>

      {!isEmpty && (
        <span className="text-[10px] text-muted-foreground">
          {assembled.length.toLocaleString()}자
        </span>
      )}

      <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border/60 bg-card/40 p-3">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center text-center">
            <p className="max-w-xs text-xs text-muted-foreground">
              프롬프트 구성이 채워지면 여기에 실시간 미리보기가 보입니다.
            </p>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
            {assembled}
          </pre>
        )}
      </div>
    </div>
  );
}

function ChatTab() {
  // PreviewTab 과 마찬가지로 publishedPrompt 를 봄.
  const prompt = useStructuringStore((s) => s.publishedPrompt);
  const targetLLM = useStructuringStore((s) => s.targetLLM);
  const chatMessages = useStructuringStore((s) => s.chatMessages);
  const clearChat = useStructuringStore((s) => s.clearChat);

  // Chat is only meaningful once the 8-region prompt has content.
  // Until then, show a disabled guidance message. Using the same
  // isEmpty signal as PreviewTab keeps the two views consistent.
  // The greeting is rendered virtually by ChatWindow directly from the
  // store, so no seeding effect is needed here.
  const isPromptEmpty = useMemo(
    () => assemblePrompt(prompt, targetLLM).trim().length === 0,
    [prompt, targetLLM]
  );

  const hasMessages = chatMessages.filter((m) => m.id !== "greeting").length > 0;

  if (isPromptEmpty) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/60 p-6">
        <div className="max-w-xs text-center space-y-1.5">
          <p className="text-sm font-medium text-foreground/80">
            대화 테스트 준비 중
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            먼저 중앙의 워크플로우에서 구성을 채우면
            <br />
            여기서 AI와 대화를 테스트할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col min-h-0 rounded-md border border-border/60 bg-card/40">
      <div className="flex shrink-0 items-center justify-end border-b border-border/40 px-2 py-1.5">
        <button
          type="button"
          onClick={clearChat}
          disabled={!hasMessages}
          title="사용자 대화만 삭제 (인사말은 유지됨)"
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
        >
          <RotateCcw className="h-3 w-3" />
          초기화
        </button>
      </div>
      {targetLLM !== "gpt" && (
        <div className="border-b border-warning/30 bg-warning/5 px-3 py-1.5 text-[10px] text-warning">
          ℹ️ Preview는 <strong>{TARGET_LLM_META[targetLLM].label}</strong> 포맷으로 조립되지만,
          실제 대화 응답은 GPT(gpt-4o)로 생성
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatWindow />
      </div>
      <div className="border-t border-border/40 p-2">
        <ChatInput />
      </div>
    </div>
  );
}

function KBExpandModal({
  item,
  onClose,
}: {
  item: KBItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Prevent background scroll while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // SSR guard: react-dom's createPortal requires document.
  if (typeof document === "undefined") return null;

  // Portal to document.body so the modal's `position: fixed` is always
  // relative to the viewport. Previously the modal was nested inside
  // the right aside (which has sticky positioning + its own scroll
  // context), and that ancestor was shifting the modal's containing
  // block so only its top sliver appeared visible.
  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`KB file: ${item.file_name}`}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(72rem, calc(100vw - 2rem))",
          height: "calc(100vh - 2rem)",
        }}
        className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              KB
            </span>
            <span
              className="truncate font-mono text-[13px] text-foreground"
              title={item.file_name}
            >
              {item.file_name}
            </span>
            <span className="text-[11px] text-muted-foreground">
              company {item.company_seq}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="닫기 (ESC)"
            aria-label="닫기"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-xs text-muted-foreground transition-all hover:border-red-500/40 hover:bg-red-600/10 hover:text-red-600 dark:hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            닫기 (ESC)
          </button>
        </div>
        <KBViewer item={item} />
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function KBTab() {
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const [items, setItems] = useState<KBItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<KBItem | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!companySeq.trim()) {
      setItems(null);
      setError(null);
      setSelected(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchKBList(companySeq);
      setItems(list);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, [companySeq]);

  useEffect(() => {
    load();
  }, [load]);

  if (!companySeq.trim()) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/60 p-4">
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          선택된 회사가 없습니다.
          <br />
          좌측 사이드바에서 회사를 선택해주세요.
        </p>
      </div>
    );
  }

  if (selected) {
    return (
      <>
        <div className="flex h-full flex-col min-h-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setExpanded(false);
              }}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              ← 목록으로
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
              aria-label="전체화면으로 보기"
            >
              <Maximize2 className="h-3 w-3" />
              확장
            </button>
          </div>
          {/*
           * KBViewer's root uses `flex-1` so it must be a direct child
           * of a flex container. Wrapping it in a block div collapses
           * its height and makes the Monaco area render as 0px.
           */}
          {!expanded && <KBViewer item={selected} />}
        </div>
        {expanded && (
          <KBExpandModal item={selected} onClose={() => setExpanded(false)} />
        )}
      </>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 min-h-0">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          company <span className="font-mono text-foreground/80">{companySeq}</span>
        </span>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded border border-border/60 px-1.5 py-0.5 hover:border-primary/40 disabled:opacity-50"
        >
          새로고침
        </button>
      </div>

      {loading && items === null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> KB 목록 불러오는 중…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          이 회사에 연결된 KB가 없습니다.
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="flex-1 min-h-0 overflow-auto space-y-1 rounded-md border border-border/60 bg-card/40 p-2">
          {items.map((it) => (
            <li key={it.file_name}>
              <button
                type="button"
                onClick={() => setSelected(it)}
                className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <span className="truncate font-mono">{it.file_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
