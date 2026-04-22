"use client";

import { useCallback, useState } from "react";
import { Loader2, CheckCircle2, Database, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore, type ApplyResult } from "@/stores/workspace-store";
import { useStructuringStore } from "@/stores/structuring-store";
import { serialize } from "@/lib/prompt-serializer";
import { CHANNEL_CODES } from "@/lib/prompt-codes";

export function ApplyStep() {
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.aiStaffSeq);
  const channel = useWorkspaceStore((s) => s.channel);

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
  const structuringPrompt = useStructuringStore((s) => s.prompt);

  const [confirming, setConfirming] = useState(false);

  const handleApply = useCallback(async () => {
    if (!channel) return;
    setApplying(true);
    setApplyStatus("idle");
    setApplyError(null);
    try {
      const serialized = serialize(structuringPrompt);
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_seq: companySeq,
          ai_staff_seq: aiStaffSeq,
          channel,
          prompt: serialized,
        }),
      });
      const data = await res.json();
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
    companySeq,
    aiStaffSeq,
    structuringPrompt,
    setApplying,
    setApplyStatus,
    setApplyError,
    setApplyResult,
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

  const svcCd = channel ? CHANNEL_CODES[channel].svc_cd : "-";
  const prmtCd = channel ? CHANNEL_CODES[channel].prmt_cd : "-";

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-1 text-xs">
        <p>
          <span className="text-muted-foreground">대상: </span>
          <span className="font-medium">
            {companySeq} / {aiStaffSeq}
          </span>{" "}
          ·{" "}
          <span className="text-muted-foreground">채널: </span>
          <span className="font-medium">{channel ?? "–"}</span>
        </p>
        <p className="text-muted-foreground">
          생성 레코드: 메인 {svcCd}/{prmtCd} + 형제 PA4000/PA1000/PC1000 (기본값 INSERT IGNORE)
        </p>
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
            프롬프트 적용
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/40"
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 적용 중…
                </>
              ) : (
                <>덮어쓰기로 적용</>
              )}
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-400">
          기존에 동일 (company_seq, ai_staff_seq, {svcCd}, {prmtCd}) 레코드가 있으면 메인은
          덮어쓰기됩니다. 형제(PA4000 · PA1000 · PC1000)는 INSERT IGNORE로 기존 값 보존합니다.
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
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-primary/40 bg-primary/5 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">프롬프트 적용 완료</p>
          <ul className="space-y-1 text-xs">
            <li className="flex items-center gap-2">
              <Database className="h-3 w-3 text-primary" />
              <span className="font-medium">
                {result.main.svc_cd} / {result.main.prmt_cd}
              </span>
              <span className="text-muted-foreground">cstm_id={result.main.cstm_id} (메인)</span>
            </li>
            {result.siblings.map((s) => (
              <li key={s.prmt_cd} className="flex items-center gap-2">
                <Database className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{s.prmt_cd}</span>
                <span className="text-muted-foreground">
                  {s.created ? `cstm_id=${s.cstm_id} (신규)` : "기존 행 유지"}
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
          className="rounded-md border border-border px-3 py-2 text-sm hover:border-primary/40"
        >
          신규 시작
        </button>
        <button
          type="button"
          onClick={onDifferentChannel}
          className="rounded-md border border-border px-3 py-2 text-sm hover:border-primary/40"
          disabled={!channel}
        >
          다른 채널 적용
        </button>
        <button
          type="button"
          onClick={onContinueEdit}
          className="rounded-md border border-border px-3 py-2 text-sm hover:border-primary/40"
        >
          편집 이어하기
        </button>
      </div>
    </div>
  );
}
