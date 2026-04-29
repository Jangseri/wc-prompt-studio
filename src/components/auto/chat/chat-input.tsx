"use client";

import { useState, useRef } from "react";
import { Send, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import { apiPath } from "@/lib/api-path";
import { useAutoStore } from "@/stores/auto-store";

export default function ChatInput() {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    addChatMessage,
    updateLastAssistantMessage,
    editedFullText,
    chatMessages,
    chatSettings,
    dummyData,
    isChatLoading,
    setIsChatLoading,
    clearChat,
  } = useAutoStore();

  const buildSystemPrompt = () => {
    let prompt = editedFullText;
    prompt = prompt.replace(/AA2001/g, dummyData.aa2001);
    prompt = prompt.replace(/AA2002/g, dummyData.aa2002);
    prompt = prompt.replace(/AA2003/g, dummyData.aa2003);
    prompt = prompt.replace(/AA1000/g, dummyData.aa1000);
    return prompt;
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isChatLoading) return;

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
      const messages = [
        ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: trimmed },
      ];

      const res = await fetch(apiPath("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: buildSystemPrompt(),
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
      <div className="flex items-end gap-2">
        <button
          onClick={clearChat}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
          title="대화 초기화"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="고객 발화를 입력하세요..."
            rows={1}
            className={cn(
              "w-full resize-none rounded-xl border border-border bg-muted px-4 py-2.5 pr-12 text-sm",
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
    </div>
  );
}
