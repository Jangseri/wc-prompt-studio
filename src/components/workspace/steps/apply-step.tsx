"use client";

import { useCallback, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore, type ApplyResult } from "@/stores/workspace-store";
import { useStructuringStore } from "@/stores/structuring-store";
import { useCodeNames } from "@/hooks/useCodeNames";
import { assemblePrompt } from "@/components/structuring/lib/assemble-prompt";
import { CHANNEL_CODES, SIBLING_PRMT_CDS } from "@/lib/prompt-codes";

export function ApplyStep() {
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.aiStaffSeq);
  const channel = useWorkspaceStore((s) => s.channel);
  const industry = useWorkspaceStore((s) => s.industry);

  const isApplying = useWorkspaceStore((s) => s.isApplying);
  const applyStatus = useWorkspaceStore((s) => s.applyStatus);
  const applyResult = useWorkspaceStore((s) => s.applyResult);
  const applyError = useWorkspaceStore((s) => s.applyError);

  const setApplying = useWorkspaceStore((s) => s.setApplying);
  const setApplyStatus = useWorkspaceStore((s) => s.setApplyStatus);
  const setApplyResult = useWorkspaceStore((s) => s.setApplyResult);
  const setApplyError = useWorkspaceStore((s) => s.setApplyError);
  const reset = useWorkspaceStore((s) => s.reset);
  const setStep = useWorkspaceStore((s) => s.setStep);
  const setChannel = useWorkspaceStore((s) => s.setChannel);
  const structuringReset = useStructuringStore((s) => s.reset);
  // 저장은 publish 된 스냅샷 기준. Regions 에서 적용 안 한 라이브
  // 편집은 일부러 무시 — 사용자가 의도적으로 이전 버전을 저장하려는
  // 케이스를 허용하기 위함.
  const structuringPrompt = useStructuringStore((s) => s.publishedPrompt);
  const targetLLM = useStructuringStore((s) => s.targetLLM);
  const { getCodeName } = useCodeNames();

  const [confirming, setConfirming] = useState(false);

  const channelLabel = channel === "callbot" ? "콜봇" : channel === "chatbot" ? "챗봇" : "–";
  const mainPrmtCd = channel ? CHANNEL_CODES[channel].prmt_cd : null;
  const mainName = mainPrmtCd ? getCodeName(mainPrmtCd) : "–";
  const siblingNames = SIBLING_PRMT_CDS.map((cd) => getCodeName(cd));

  const handleApply = useCallback(async () => {
    if (!channel) return;
    setApplying(true);
    setApplyStatus("idle");
    setApplyError(null);
    try {
      // Save the rendered prompt (what Preview shows) — not the
      // internal round-trip serialization. The stored text is consumed
      // as-is by downstream LLM runners, and Management edits it as
      // plain text.
      const rendered = assemblePrompt(structuringPrompt, targetLLM);
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_seq: companySeq,
          ai_staff_seq: aiStaffSeq,
          channel,
          industry,
          prompt: rendered,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        // Strict no-overwrite policy: existing rows block the apply.
        // Surface the specific prmt_cds and direct the user to the
        // management flow for in-place editing.
        const existing = Array.isArray(data?.existingPrmtCds)
          ? (data.existingPrmtCds as string[])
          : [];
        const names = existing.map((cd) => {
          const display = getCodeName(cd);
          return display && display !== cd ? `${display}(${cd})` : cd;
        });
        const list = names.length > 0 ? ` (${names.join(", ")})` : "";
        const msg = `이미 등록된 프롬프트가 있어 저장할 수 없습니다${list}. '프롬프트 관리'에서 편집해주세요.`;
        setApplyError(msg);
        setApplyStatus("error");
        toast.error("기존 프롬프트가 있어 저장할 수 없습니다");
        return;
      }
      if (!res.ok || !data.success) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const result: ApplyResult = {
        main: {
          cstm_id: data.data.main.cstm_id,
          svc_cd: data.data.main.svc_cd,
          prmt_cd: data.data.main.prmt_cd,
        },
        siblings: data.data.siblings,
      };
      setApplyResult(result);
      setApplyStatus("success");
      toast.success("4개 레코드가 저장되었습니다");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setApplyError(msg);
      setApplyStatus("error");
      toast.error(`적용 실패: ${msg}`);
    } finally {
      setApplying(false);
      setConfirming(false);
    }
  }, [
    channel,
    industry,
    companySeq,
    aiStaffSeq,
    structuringPrompt,
    targetLLM,
    setApplying,
    setApplyStatus,
    setApplyError,
    setApplyResult,
    getCodeName,
  ]);

  if (applyStatus === "success" && applyResult) {
    return (
      <ApplyDone
        result={applyResult}
        channel={channel}
        onNew={() => {
          reset();
          structuringReset();
        }}
        onDifferentChannel={() => {
          setChannel(null);
          setApplyStatus("idle");
          setApplyResult(null);
          setStep("source");
        }}
        onContinueEdit={() => {
          setStep("regions");
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          아래 내용으로 프롬프트를 저장합니다.
        </p>
        <dl className="space-y-1.5 text-xs">
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted-foreground">회사</dt>
            <dd className="font-mono text-foreground/90">{companySeq || "–"}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted-foreground">담당자</dt>
            <dd className="font-mono text-foreground/90">{aiStaffSeq || "–"}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted-foreground">채널</dt>
            <dd className="font-medium">{channelLabel}</dd>
          </div>
        </dl>
        <div className="rounded-md border border-border/50 bg-background/40 p-2.5 space-y-1.5">
          <p className="text-[11px] font-medium text-foreground/80">저장될 프롬프트</p>
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            <li>
              <span className="mr-1 text-primary">●</span>
              <span className="text-foreground/90">{mainName}</span>{" "}
              <span className="text-muted-foreground">(메인)</span>
            </li>
            {siblingNames.map((name, i) => (
              <li key={SIBLING_PRMT_CDS[i]}>
                <span className="mr-1">○</span>
                {name} <span>(관련)</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground pt-1">
            이 회사·담당자에 이미 등록된 프롬프트가 하나라도 있으면{" "}
            <span className="font-medium">저장이 거부</span>됩니다. 기존 프롬프트는{" "}
            <span className="font-medium">&apos;프롬프트 관리&apos;</span>에서 편집해주세요.
          </p>
        </div>
      </div>

      {applyError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{applyError}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <button
          type="button"
          onClick={() => useWorkspaceStore.getState().goPrev()}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary/40"
          disabled={isApplying}
        >
          ← 이전
        </button>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={isApplying || !channel}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            저장
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-smooth hover:border-primary/50 hover:bg-muted hover:text-foreground disabled:opacity-50"
              disabled={isApplying}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 저장 중…
                </>
              ) : (
                <>확인하고 저장</>
              )}
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-400">
          위 내용으로 새 프롬프트를 저장합니다. 이 회사·담당자에 이미 등록된 프롬프트가 있으면
          저장이 <span className="font-semibold">거부</span>됩니다 (덮어쓰기 안 됨).
        </p>
      )}
    </div>
  );
}

interface ApplyDoneProps {
  result: ApplyResult;
  channel: string | null;
  onNew: () => void;
  onDifferentChannel: () => void;
  onContinueEdit: () => void;
}

function ApplyDone({
  result,
  channel,
  onNew,
  onDifferentChannel,
  onContinueEdit,
}: ApplyDoneProps) {
  const { getCodeName } = useCodeNames();
  const mainName = getCodeName(result.main.prmt_cd);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-primary/40 bg-primary/5 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">저장이 완료되었습니다</p>
          <ul className="space-y-1 text-xs">
            <li>
              <span className="mr-1 text-primary">●</span>
              <span className="font-medium text-foreground/90">{mainName}</span>{" "}
              <span className="text-muted-foreground">(메인 · 저장됨)</span>
            </li>
            {result.siblings.map((s) => (
              <li key={s.prmt_cd}>
                <span className="mr-1">○</span>
                <span className="text-foreground/90">{getCodeName(s.prmt_cd)}</span>{" "}
                <span className="text-muted-foreground">
                  ({s.created ? "신규 추가" : "기존 값 유지"})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onNew}
          className="rounded-md border border-border px-3 py-2 text-sm hover:border-primary/40 hover:bg-muted"
        >
          새 워크플로우 시작
        </button>
        <button
          type="button"
          onClick={onDifferentChannel}
          className="rounded-md border border-border px-3 py-2 text-sm hover:border-primary/40 hover:bg-muted disabled:opacity-50"
          disabled={!channel}
        >
          다른 채널에도 적용
        </button>
        <button
          type="button"
          onClick={onContinueEdit}
          className="rounded-md border border-border px-3 py-2 text-sm hover:border-primary/40 hover:bg-muted"
        >
          계속 편집
        </button>
      </div>
    </div>
  );
}
