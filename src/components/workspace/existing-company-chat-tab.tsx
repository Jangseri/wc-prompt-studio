"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, RotateCcw, Send, User } from "lucide-react";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { apiPath } from "@/lib/api-path";
import {
  CHANNEL_LABEL,
  SVC_CD_ORDER,
  isCallbotSvcCd,
  isChatbotSvcCd,
} from "@/lib/prompt-codes";
import type { CstmPrmtInfo } from "@/types/editor";
import type { ChatMessage } from "@/types/chat";

/**
 * manage 모드 우측 패널의 [Chat] 탭.
 *
 * 선택된 (company_seq, ai_staff_seq) 의 PD2000(콜봇 대화_텍스트) 또는
 * PD0000(챗봇 대화_텍스트) 프롬프트를 systemPrompt 로 사용해 GPT 와
 * 자유 발화 테스트. workflow 의 ChatTab 과는 다른 store/로컬 state 를
 * 써서 두 채팅이 섞이지 않게 한다 (요구사항).
 *
 * 채널이 여러 개일 때는 상단 selector 에서 고른다. company/staff/channel
 * 이 바뀌면 메시지를 자동 리셋해서 stale 한 컨텍스트가 다음 회사로
 * 새지 않도록 함.
 */

// 대화_텍스트 prmt_cd. 콜봇=PD2000, 챗봇=PD0000.
const DIALOG_PRMT_CDS = new Set(["PD2000", "PD0000"]);

// svc_cd → biz-time API 의 chnnTp 값 매핑. 콜봇 계열(SA1000/SA1200) 은
// voice, 챗봇(SA2000) 은 chat. 매핑할 수 없는 svc_cd 는 null 을 돌려
// fetch 자체를 스킵 (인사말 없음 처리).
function svcCdToChnnTp(svc_cd: string): "voice" | "chat" | null {
  if (isCallbotSvcCd(svc_cd)) return "voice";
  if (isChatbotSvcCd(svc_cd)) return "chat";
  return null;
}

interface AvailableChannel {
  svc_cd: string;
  prompt: CstmPrmtInfo;
}

export function ExistingCompanyChatTab() {
  const companySeq = useWorkspaceStore((s) => s.selectedCompanySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.selectedAiStaffSeq);

  const [prompts, setPrompts] = useState<CstmPrmtInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSvcCd, setSelectedSvcCd] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // biz-time/dayon/curr 의 msgIntro 를 가상 인사말로 첫 어시스턴트 턴
  // 자리에 표시. messages 배열엔 저장하지 않고(virtual) workflow chat 의
  // greeting 처리 패턴을 그대로 따른다 — 채널 전환 시 갱신이 자연스러움.
  const [greeting, setGreeting] = useState<string | null>(null);
  const [greetingLoading, setGreetingLoading] = useState(false);

  const load = useCallback(async () => {
    if (!companySeq || !aiStaffSeq) {
      setPrompts(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        company_seq: companySeq,
        ai_staff_seq: aiStaffSeq,
      });
      const res = await fetch(apiPath(`/api/prompts?${params.toString()}`));
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setPrompts(data.data as CstmPrmtInfo[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPrompts(null);
    } finally {
      setLoading(false);
    }
  }, [companySeq, aiStaffSeq]);

  useEffect(() => {
    load();
  }, [load]);

  // 사용 가능한 채널: 활성(status=Y) PD2000/PD0000 행만. svc_cd 별로 1개씩.
  // SVC_CD_ORDER 로 정렬해서 콜봇이 위, 챗봇이 아래로 일관되게 보이게.
  const availableChannels = useMemo<AvailableChannel[]>(() => {
    if (!prompts) return [];
    const map = new Map<string, CstmPrmtInfo>();
    for (const p of prompts) {
      if (p.status !== "Y") continue;
      if (!DIALOG_PRMT_CDS.has(p.prmt_cd)) continue;
      // 한 svc_cd 에 동일 prmt_cd 가 중복되는 일은 스키마상 없지만,
      // 혹시 있으면 가장 최근 updt_dt 가 이기게.
      const prev = map.get(p.svc_cd);
      if (!prev || p.updt_dt > prev.updt_dt) map.set(p.svc_cd, p);
    }
    const list = Array.from(map.entries()).map(([svc_cd, prompt]) => ({
      svc_cd,
      prompt,
    }));
    list.sort((a, b) => {
      const ai = SVC_CD_ORDER.indexOf(a.svc_cd);
      const bi = SVC_CD_ORDER.indexOf(b.svc_cd);
      const sa = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const sb = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      if (sa !== sb) return sa - sb;
      return a.svc_cd.localeCompare(b.svc_cd);
    });
    return list;
  }, [prompts]);

  // company/staff 가 바뀔 때마다 채널 선택과 대화 히스토리를 비움.
  // 이전 회사 컨텍스트가 다음 회사로 흘러가는 걸 차단. greeting 도 같이
  // 비워서 직전 회사의 인사말이 잠깐 보이는 깜빡임을 막는다.
  useEffect(() => {
    setSelectedSvcCd(null);
    setMessages([]);
    setInput("");
    setGreeting(null);
  }, [companySeq, aiStaffSeq]);

  // 채널 목록이 로드되면 기본값 자동 선택 (콜봇 우선).
  useEffect(() => {
    if (availableChannels.length === 0) {
      setSelectedSvcCd(null);
      return;
    }
    setSelectedSvcCd((prev) => {
      if (prev && availableChannels.some((c) => c.svc_cd === prev)) return prev;
      const callbot = availableChannels.find((c) => isCallbotSvcCd(c.svc_cd));
      return (callbot ?? availableChannels[0]).svc_cd;
    });
  }, [availableChannels]);

  // 채널을 직접 바꿔도 히스토리는 리셋. 이전 채널의 systemPrompt 로
  // 쌓인 어시스턴트 응답을 다음 채널 대화에 섞으면 컨텍스트가 깨짐.
  // greeting 도 같이 비워서 fetch 가 끝나기 전까지 이전 채널 인사말이
  // 잘못 노출되지 않도록 한다.
  const handleSelectChannel = useCallback((svc_cd: string) => {
    setSelectedSvcCd((prev) => {
      if (prev !== svc_cd) {
        setMessages([]);
        setInput("");
        setGreeting(null);
      }
      return svc_cd;
    });
  }, []);

  // selectedSvcCd 가 정해지면 /api/biz-time 에 인사말 조회.
  // ai_staff_seq + chnn_tp(voice/chat) 조합으로 upstream 호출.
  // 응답이 늦게 도착했을 때 이미 다른 채널/회사로 바뀐 상태에 결과가
  // 덮어쓰는 race 를 막기 위해 cancelled 플래그로 보호.
  useEffect(() => {
    if (!aiStaffSeq || !selectedSvcCd) {
      setGreeting(null);
      return;
    }
    const chnnTp = svcCdToChnnTp(selectedSvcCd);
    if (!chnnTp) {
      setGreeting(null);
      return;
    }
    let cancelled = false;
    setGreetingLoading(true);
    (async () => {
      try {
        const qs = new URLSearchParams({
          ai_staff_seq: aiStaffSeq,
          chnn_tp: chnnTp,
        });
        const res = await fetch(apiPath(`/api/biz-time?${qs.toString()}`));
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data?.success) {
          setGreeting(
            typeof data.data?.greeting === "string" ? data.data.greeting : null
          );
        } else {
          setGreeting(null);
        }
      } catch {
        if (!cancelled) setGreeting(null);
      } finally {
        if (!cancelled) setGreetingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aiStaffSeq, selectedSvcCd]);

  const selectedPrompt = useMemo(() => {
    if (!selectedSvcCd) return null;
    return availableChannels.find((c) => c.svc_cd === selectedSvcCd)?.prompt ?? null;
  }, [availableChannels, selectedSvcCd]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isChatLoading || !selectedPrompt) return;

    const userMsg: ChatMessage = {
      id: nanoid(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: ChatMessage = {
      id: nanoid(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsChatLoading(true);

    try {
      // workflow chat 과 동일 패턴: greeting 은 messages 에 저장되지 않으므로
      // 호출 시점에 첫 어시스턴트 턴으로 합성해서 GPT 가 대화 맥락을 인식
      // 하게 한다. 비어있으면 그냥 빼고 보냄.
      const greetingText = greeting?.trim() ?? "";
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const composedMessages = [
        ...(greetingText
          ? [{ role: "assistant" as const, content: greetingText }]
          : []),
        ...history,
        { role: "user", content: trimmed },
      ];
      const res = await fetch(apiPath("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: selectedPrompt.prompt,
          messages: composedMessages,
          settings: { temperature: 0.25, maxTokens: 1024 },
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
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = prev.slice();
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, content: accumulated };
          }
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            content: "죄송합니다. 응답 생성 중 오류가 발생했습니다.",
          };
        }
        return next;
      });
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

  const clearMessages = () => setMessages([]);

  if (!companySeq || !aiStaffSeq) {
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

  if (loading && prompts === null) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 프롬프트 불러오는 중…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        <p className="font-medium">프롬프트를 불러올 수 없습니다</p>
        <p className="mt-1 opacity-80">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-2 rounded-md border border-destructive/40 px-2 py-1 text-[11px] hover:bg-destructive/20"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (availableChannels.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/60 p-6">
        <div className="max-w-xs space-y-1.5 text-center">
          <p className="text-sm font-medium text-foreground/80">
            테스트할 대화 프롬프트가 없습니다
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            이 회사·스태프 조합에 활성화된
            <br />
            PD2000(콜봇) 또는 PD0000(챗봇) 프롬프트가 필요합니다.
          </p>
        </div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col min-h-0 gap-2">
      {/* 채널 selector + 초기화 — 한 줄 */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[11px] text-muted-foreground">채널</span>
        <div className="flex flex-1 flex-wrap gap-0.5 rounded-md bg-muted p-0.5">
          {availableChannels.map((c) => {
            const isActive = selectedSvcCd === c.svc_cd;
            const label = CHANNEL_LABEL[c.svc_cd] ?? c.svc_cd;
            return (
              <button
                key={c.svc_cd}
                type="button"
                onClick={() => handleSelectChannel(c.svc_cd)}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-smooth",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={`${c.prompt.prmt_cd} · svc_cd ${c.svc_cd}`}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isCallbotSvcCd(c.svc_cd) && "bg-primary",
                    isChatbotSvcCd(c.svc_cd) && "bg-emerald-400",
                    !isCallbotSvcCd(c.svc_cd) &&
                      !isChatbotSvcCd(c.svc_cd) &&
                      "bg-muted-foreground"
                  )}
                />
                {label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={clearMessages}
          disabled={!hasMessages}
          title="대화 기록 삭제"
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
        >
          <RotateCcw className="h-3 w-3" />
          초기화
        </button>
      </div>

      {selectedPrompt && (
        <p className="text-[10px] text-muted-foreground">
          system prompt{" "}
          <span className="font-mono text-foreground/70">
            {selectedPrompt.prmt_cd}
          </span>{" "}
          · {selectedPrompt.prompt.length.toLocaleString()}자
        </p>
      )}

      {/* 메시지 영역 + 입력창 */}
      <div className="flex flex-1 flex-col min-h-0 rounded-md border border-border/60 bg-card/40">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          style={{ scrollbarGutter: "stable" }}
        >
          {/* virtual greeting bubble — 메시지 배열엔 없지만 시각적으로
              항상 첫 어시스턴트 턴 자리에 인사말을 보여줌. 빈 상태일 땐
              아래 안내문구 대신 이 인사말이 노출되어 자연스럽게 대화
              시작 가능. greeting 이 비어있고(아직 로딩 중이거나 응답
              실패) 메시지도 없으면 기존 안내 화면으로 폴백. */}
          {greeting && greeting.trim() && (
            <div className="flex justify-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">
                <p className="whitespace-pre-wrap">{greeting}</p>
              </div>
            </div>
          )}
          {messages.length === 0 && !greeting && !greetingLoading ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h3 className="mb-2 text-sm font-semibold">대화 테스트</h3>
              <p className="max-w-sm text-[11px] text-muted-foreground">
                아래에 발화를 입력하면, 선택한 채널의 저장된 PD2000/PD0000
                프롬프트를 시스템 프롬프트로 사용해 GPT 가 응답합니다.
              </p>
            </div>
          ) : messages.length === 0 && greetingLoading && !greeting ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> 인사말 불러오는 중…
            </div>
          ) : (
            messages.map((msg) => {
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
            })
          )}
          {isChatLoading && (() => {
            const last = messages[messages.length - 1];
            const isStreaming = last?.role === "assistant" && last.content;
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

        <div className="border-t border-border/40 p-3">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedPrompt
                  ? "테스트 발화를 입력하세요..."
                  : "채널을 먼저 선택해주세요"
              }
              disabled={!selectedPrompt}
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl border border-border bg-muted px-3 py-2 pr-11 text-xs",
                "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50",
                "max-h-32 transition-smooth disabled:opacity-50"
              )}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isChatLoading || !selectedPrompt}
              className={cn(
                "absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg transition-smooth",
                input.trim() && !isChatLoading && selectedPrompt
                  ? "bg-primary text-primary-foreground hover:bg-primary/80"
                  : "bg-muted text-muted-foreground/40"
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
