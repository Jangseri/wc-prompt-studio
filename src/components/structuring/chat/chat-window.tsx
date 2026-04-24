"use client";

import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStructuringStore } from "@/stores/structuring-store";

export function ChatWindow() {
  const chatMessages = useStructuringStore((s) => s.chatMessages);
  const greeting = useStructuringStore((s) => s.prompt.companyInfo.greeting);
  const isChatLoading = useStructuringStore((s) => s.isChatLoading);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualGreeting = greeting.trim();
  // Filter out any legacy seeded greeting (id === "greeting") — we now
  // render the greeting virtually from store state so it stays in sync
  // with Regions edits.
  const realMessages = chatMessages.filter((m) => m.id !== "greeting");

  // Tracks the previous "real" message count so we can distinguish a
  // `clearChat` (cleared) from an add/stream update (grown).
  const prevRealCountRef = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const realCount = chatMessages.filter((m) => m.id !== "greeting").length;
    const prevCount = prevRealCountRef.current;
    if (realCount === 0 && prevCount > 0) {
      // Cleared — scroll to the top so the greeting sits in its
      // natural starting position rather than jumping into view as if
      // freshly generated.
      el.scrollTop = 0;
    } else if (realCount > 0) {
      // New message added or streaming content growing — follow to
      // the bottom so the latest turn stays in focus.
      el.scrollTop = el.scrollHeight;
    }
    prevRealCountRef.current = realCount;
  }, [chatMessages]);

  if (!virtualGreeting && realMessages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Bot className="h-7 w-7 text-primary" />
        </div>
        <h3 className="mb-2 text-sm font-semibold">대화 테스트</h3>
        <p className="max-w-sm text-[11px] text-muted-foreground">
          아래에 발화를 입력하면, 현재 영역화된 프롬프트를 시스템 프롬프트로 사용해
          AI가 응답합니다.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
      style={{ scrollbarGutter: "stable" }}
    >
      {virtualGreeting && (
        <div className="flex justify-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">
            <p className="whitespace-pre-wrap">{virtualGreeting}</p>
          </div>
        </div>
      )}
      {realMessages.map((msg) => {
        if (msg.role === "assistant" && !msg.content) return null;

        return (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        );
      })}
      {isChatLoading && (() => {
        const lastMsg = chatMessages[chatMessages.length - 1];
        const isStreaming = lastMsg?.role === "assistant" && lastMsg.content;
        if (isStreaming) return null;
        return (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
