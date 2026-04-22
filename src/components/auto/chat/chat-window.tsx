"use client";

import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutoStore } from "@/stores/auto-store";

export default function ChatWindow() {
  const { chatMessages, isChatLoading } = useAutoStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  if (chatMessages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">대화 테스트</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          생성된 프롬프트를 기반으로 AI와 대화를 나눠보세요.
          아래 입력창에 고객 발화를 입력하면 콜봇이 응답합니다.
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {chatMessages.map((msg) => {
        // Skip empty assistant messages while loading indicator is shown
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
                "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
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
