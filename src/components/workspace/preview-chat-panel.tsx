"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Check, FileText, Loader2, MessageSquare, Database } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStructuringStore } from "@/stores/structuring-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { assemblePrompt } from "@/components/structuring/lib/assemble-prompt";
import { ChatWindow } from "@/components/structuring/chat/chat-window";
import { ChatInput } from "@/components/structuring/chat/chat-input";
import { KBViewer } from "@/components/editor/KBViewer";
import { fetchKBList } from "@/lib/kb-api";
import type { KBItem } from "@/types/editor";

type RightTab = "preview" | "chat" | "kb";

const TABS: { id: RightTab; label: string; icon: typeof FileText }[] = [
  { id: "preview", label: "Preview", icon: FileText },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "kb", label: "KB", icon: Database },
];

export function PreviewChatPanel() {
  const [active, setActive] = useState<RightTab>("preview");

  return (
    <div className="flex h-full flex-col gap-3 min-h-0">
      <div className="flex items-center gap-1 rounded-md border border-border/50 p-1">
        {TABS.map((t) => {
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

function PreviewTab() {
  const prompt = useStructuringStore((s) => s.prompt);
  const targetLLM = useStructuringStore((s) => s.targetLLM);
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
    <div className="flex h-full flex-col min-h-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          조립된 프롬프트 · target {targetLLM}
          {!isEmpty && ` · ${assembled.length.toLocaleString()}자`}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          disabled={isEmpty}
          className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "복사됨" : "복사"}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border/60 bg-card/40 p-3">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center text-center">
            <p className="max-w-xs text-xs text-muted-foreground">
              8영역을 작성하면 여기에 실시간 조립된 프롬프트가 보입니다.
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
  return (
    <div className="flex h-full flex-col min-h-0 rounded-md border border-border/60 bg-card/40">
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatWindow />
      </div>
      <div className="border-t border-border/40 p-2">
        <ChatInput />
      </div>
    </div>
  );
}

function KBTab() {
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const [items, setItems] = useState<KBItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<KBItem | null>(null);

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
          Setup 스텝에서 company_seq를 입력하면 해당 회사의 KB 목록이 표시됩니다.
        </p>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex h-full flex-col min-h-0">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-2 self-start rounded-md border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40"
        >
          ← 목록으로
        </button>
        <div className="flex-1 min-h-0">
          <KBViewer item={selected} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 min-h-0">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          company_seq <span className="font-mono text-foreground/80">{companySeq}</span>
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
