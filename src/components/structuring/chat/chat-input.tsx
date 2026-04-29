"use client";

import { useState, useRef } from "react";
import { Send } from "lucide-react";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import { useStructuringStore } from "@/stores/structuring-store";
import { apiPath } from "@/lib/api-path";
import { assemblePrompt } from "../lib/assemble-prompt";

export function ChatInput() {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    addChatMessage,
    updateLastAssistantMessage,
    // Chat 으로 보내는 system prompt 와 인사말은 publish 된 스냅샷
    // 기준. Regions 의 라이브 편집은 적용 전까진 chat 응답에 영향 X.
    publishedPrompt: prompt,
    targetLLM,
    chatMessages,
    chatSettings,
    isChatLoading,
    setIsChatLoading,
  } = useStructuringStore();

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isChatLoading) return;

    const systemPrompt = assemblePrompt(prompt, targetLLM);
    if (!systemPrompt.trim()) {
      addChatMessage({
        id: nanoid(),
        role: "assistant",
        content: "⚠️ 영역을 먼저 작성해주세요. 시스템 프롬프트가 비어 있습니다.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userMsg = {
      id: nanoid(),
      role: "user" as const,
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMsg);
    setInput("");
    setIsChatLoading(true);

    const assistantMsg = {
      id: nanoid(),
      role: "assistant" as const,
      content: "",
      timestamp: new Date().toISOString(),
    };
    addChatMessage(assistantMsg);

    try {
      // Greeting is rendered virtually in ChatWindow (not stored in
      // chatMessages) so it stays in sync with Regions edits. Prepend
      // it here as a synthetic assistant turn so the LLM sees the full
      // conversation context. Also drop any legacy seeded greeting.
      const greetingText = prompt.companyInfo.greeting.trim();
      const history = chatMessages
        .filter((m) => m.id !== "greeting")
        .map((m) => ({ role: m.role, content: m.content }));
      const messages = [
        ...(greetingText
          ? [{ role: "assistant" as const, content: greetingText }]
          : []),
        ...history,
        { role: "user" as const, content: trimmed },
      ];

      const res = await fetch(apiPath("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          messages,
          settings: chatSettings,
        }),
      });

      if (!res.ok) throw new Error("Chat API error");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        updateLastAssistantMessage(accumulated);
      }
    } catch {
      updateLastAssistantMessage("죄송합니다. 응답 생성 중 오류가 발생했습니다.");
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border p-4">
      <div className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="테스트 발화를 입력하세요..."
          rows={1}
          className={cn(
            "w-full resize-none rounded-xl border border-border bg-muted px-3 py-2 pr-11 text-xs",
            "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50",
            "max-h-32 transition-smooth"
          )}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isChatLoading}
          className={cn(
            "absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg transition-smooth",
            input.trim() && !isChatLoading
              ? "bg-primary text-primary-foreground hover:bg-primary/80"
              : "bg-muted text-muted-foreground/40"
          )}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
