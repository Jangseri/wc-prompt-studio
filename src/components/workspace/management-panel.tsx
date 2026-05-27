"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Save,
  CircleDot,
  Circle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useCodeNames } from "@/hooks/useCodeNames";
import { apiPath } from "@/lib/api-path";
import {
  CHANNEL_LABEL,
  SVC_CD_ORDER,
  isCallbotSvcCd,
  isChatbotSvcCd,
} from "@/lib/prompt-codes";
import type { CstmPrmtInfo } from "@/types/editor";

const PRMT_ORDER: Record<string, number> = {
  PD2000: 0,
  PD0000: 0,
  PA4000: 1,
  PA1000: 2,
  PC1000: 3,
};

function sortPrompts(a: CstmPrmtInfo, b: CstmPrmtInfo): number {
  const ap = PRMT_ORDER[a.prmt_cd] ?? 99;
  const bp = PRMT_ORDER[b.prmt_cd] ?? 99;
  if (ap !== bp) return ap - bp;
  return a.prmt_cd.localeCompare(b.prmt_cd);
}

interface ChannelGroup {
  svc_cd: string;
  items: CstmPrmtInfo[];
}

/** Group sorted items by svc_cd. Output order = SVC_CD_ORDER first, then
 *  any unknown svc_cds in alphabetical order (stable). */
function groupBySvcCd(items: CstmPrmtInfo[]): ChannelGroup[] {
  const map = new Map<string, CstmPrmtInfo[]>();
  for (const it of items) {
    if (!map.has(it.svc_cd)) map.set(it.svc_cd, []);
    map.get(it.svc_cd)!.push(it);
  }
  const groups: ChannelGroup[] = [];
  for (const svc_cd of SVC_CD_ORDER) {
    const list = map.get(svc_cd);
    if (list) {
      groups.push({ svc_cd, items: list });
      map.delete(svc_cd);
    }
  }
  for (const [svc_cd, list] of [...map.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    groups.push({ svc_cd, items: list });
  }
  return groups;
}

export function ManagementPanel() {
  const companySeq = useWorkspaceStore((s) => s.selectedCompanySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.selectedAiStaffSeq);
  const goIdle = useWorkspaceStore((s) => s.goIdle);
  const { getCodeName } = useCodeNames();

  const [items, setItems] = useState<CstmPrmtInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!companySeq || !aiStaffSeq) {
      setItems(null);
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
      const rows = (data.data as CstmPrmtInfo[]).slice().sort(sortPrompts);
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, [companySeq, aiStaffSeq]);

  useEffect(() => {
    load();
  }, [load]);

  if (!companySeq || !aiStaffSeq) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/60 p-6">
        <p className="text-sm text-muted-foreground">
          좌측에서 회사를 선택해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">프롬프트 관리</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            company{" "}
            <span className="font-mono text-foreground/80">{companySeq}</span> · staff{" "}
            <span className="font-mono text-foreground/80">{aiStaffSeq}</span>
            {items && ` · ${items.length}건`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-md border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 disabled:opacity-50"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={goIdle}
            className="rounded-md border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40"
          >
            닫기
          </button>
        </div>
      </div>

      {loading && items === null && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 프롬프트 조회 중…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <p className="font-medium">조회 실패</p>
          <p className="mt-1 opacity-80">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-2 rounded-md border border-destructive/40 px-2 py-1 text-[11px] hover:bg-destructive/20"
          >
            다시 시도
          </button>
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-md border border-dashed border-border/60 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            이 회사에 등록된 프롬프트가 없습니다.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-5">
          {(() => {
            const groups = groupBySvcCd(items);
            const handleSaved = (updated: CstmPrmtInfo) => {
              setItems((prev) =>
                prev
                  ? prev.map((it) =>
                      it.cstm_id === updated.cstm_id ? updated : it
                    )
                  : prev
              );
              setEditingId(null);
            };
            const handleStatusToggled = (updated: CstmPrmtInfo) => {
              setItems((prev) =>
                prev
                  ? prev.map((it) =>
                      it.cstm_id === updated.cstm_id ? updated : it
                    )
                  : prev
              );
            };
            return groups.map((g) => (
              <section key={g.svc_cd} className="space-y-2">
                <header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-1 py-1 backdrop-blur">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-medium",
                      isCallbotSvcCd(g.svc_cd) && "bg-primary/10 text-primary",
                      isChatbotSvcCd(g.svc_cd) &&
                        "bg-emerald-500/10 text-emerald-400",
                      !isCallbotSvcCd(g.svc_cd) &&
                        !isChatbotSvcCd(g.svc_cd) &&
                        "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {CHANNEL_LABEL[g.svc_cd] ?? g.svc_cd}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {g.svc_cd}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {g.items.length}건
                  </span>
                </header>
                <ul className="space-y-2">
                  {g.items.map((item) => (
                    <PromptCard
                      key={item.cstm_id}
                      item={item}
                      codeName={getCodeName(item.prmt_cd)}
                      isEditing={editingId === item.cstm_id}
                      onStartEdit={() => setEditingId(item.cstm_id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSaved={handleSaved}
                      onStatusToggled={handleStatusToggled}
                    />
                  ))}
                </ul>
              </section>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

interface PromptCardProps {
  item: CstmPrmtInfo;
  codeName: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: (updated: CstmPrmtInfo) => void;
  onStatusToggled: (updated: CstmPrmtInfo) => void;
}

function PromptCard({
  item,
  codeName,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaved,
  onStatusToggled,
}: PromptCardProps) {
  const [promptDraft, setPromptDraft] = useState(item.prompt);
  const [jsonDraft, setJsonDraft] = useState(item.json_schema ?? "");
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  // 미리보기 박스 클릭 시 풀스크린 read-only 모달 오픈.
  // 편집 모드(isEditing) 일 땐 미리보기 자체가 사라지므로 같이 닫아주는
  // useEffect 는 따로 없어도 무방하지만, 안전을 위해 false 로 명시 가능.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setPromptDraft(item.prompt);
      setJsonDraft(item.json_schema ?? "");
    }
  }, [isEditing, item.prompt, item.json_schema]);

  const jsonInvalid = useMemo(() => {
    const trimmed = jsonDraft.trim();
    if (!trimmed) return false;
    try {
      JSON.parse(trimmed);
      return false;
    } catch {
      return true;
    }
  }, [jsonDraft]);

  const hasChanges =
    promptDraft !== item.prompt || (jsonDraft || null) !== (item.json_schema ?? null);

  const handleSave = async () => {
    if (jsonInvalid) {
      toast.error("JSON Schema 형식이 올바르지 않습니다");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiPath(`/api/prompts/${item.cstm_id}`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: promptDraft,
          json_schema: jsonDraft.trim() === "" ? null : jsonDraft,
          updt_dt: item.updt_dt,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      toast.success("저장되었습니다");
      onSaved(data.data as CstmPrmtInfo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`저장 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    const next = item.status === "Y" ? "N" : "Y";
    setTogglingStatus(true);
    try {
      const res = await fetch(apiPath(`/api/prompts/${item.cstm_id}`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: next,
          updt_dt: item.updt_dt,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      onStatusToggled(data.data as CstmPrmtInfo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`상태 변경 실패: ${msg}`);
    } finally {
      setTogglingStatus(false);
    }
  };

  return (
    <li
      className={cn(
        "rounded-lg border bg-card/40 p-4",
        isEditing ? "border-primary/40" : "border-border/60"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {codeName && codeName !== item.prmt_cd ? (
            <span className="text-sm font-semibold">{codeName}</span>
          ) : (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {item.prmt_cd}
            </span>
          )}
          <span
            className="font-mono text-[10px] text-muted-foreground"
            title={`prmt_cd ${item.prmt_cd} · svc_cd ${item.svc_cd}`}
          >
            {item.prmt_cd}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={togglingStatus || isEditing}
            title={`상태: ${item.status}`}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-smooth",
              item.status === "Y"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-border/60 bg-muted/40 text-muted-foreground",
              "disabled:opacity-50"
            )}
          >
            {item.status === "Y" ? (
              <CircleDot className="h-3 w-3" />
            ) : (
              <Circle className="h-3 w-3" />
            )}
            {item.status === "Y" ? "활성" : "비활성"}
          </button>
          {!isEditing && (
            <button
              type="button"
              onClick={onStartEdit}
              className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              편집
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        수정: {item.updt_dt}
      </p>

      {!isEditing && (
        <pre
          onClick={() => {
            // 사용자가 텍스트를 드래그·선택 중이면 모달을 열지 않는다.
            // (복사 목적으로 영역을 선택하다가 mouseup 으로 click 이
            // 발생해 모달이 튀어오르는 부작용 방지)
            const sel = typeof window !== "undefined" ? window.getSelection() : null;
            if (sel && sel.toString().length > 0) return;
            setExpanded(true);
          }}
          title="클릭하면 전체 내용 보기"
          className="mt-3 max-h-48 overflow-auto rounded border border-border/40 bg-muted/60 p-2 text-[11px] whitespace-pre-wrap cursor-zoom-in transition-colors hover:border-primary/40"
        >
          {item.prompt}
        </pre>
      )}
      {expanded && !isEditing && (
        <PromptExpandModal
          prmtCd={item.prmt_cd}
          codeName={codeName}
          prompt={item.prompt}
          onClose={() => setExpanded(false)}
        />
      )}

      {isEditing && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              prompt
            </label>
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              className="h-64 w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-primary/50"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>json_schema</span>
              {jsonInvalid && (
                <span className="text-destructive">JSON 형식 오류</span>
              )}
            </label>
            <textarea
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              placeholder="null로 비워두려면 빈 값으로"
              className={cn(
                "h-40 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed outline-none",
                jsonInvalid
                  ? "border-destructive/60 focus:border-destructive"
                  : "border-border focus:border-primary/50"
              )}
              spellCheck={false}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={saving}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-smooth hover:border-primary/50 hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges || jsonInvalid}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              저장
            </button>
          </div>
        </div>
      )}

    </li>
  );
}

interface PromptExpandModalProps {
  prmtCd: string;
  codeName: string;
  prompt: string;
  onClose: () => void;
}

/**
 * PromptCard 미리보기 박스를 클릭했을 때 띄우는 read-only 풀스크린 모달.
 * KBExpandModal 의 구조를 그대로 차용한다 (ESC/배경 클릭 닫기, body
 * 스크롤 잠금, document.body 로 portal). 편집 기능은 의도적으로 빠져
 * 있음 — 편집 UX 개선은 별도 작업에서 다룬다.
 */
function PromptExpandModal({
  prmtCd,
  codeName,
  prompt,
  onClose,
}: PromptExpandModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("프롬프트 복사됨");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사에 실패했습니다");
    }
  };

  // SSR 가드: createPortal 은 document 가 있어야 한다.
  if (typeof document === "undefined") return null;

  // 카드 라벨이 코드명 우선, 없으면 prmt_cd 였던 미리보기 헤더 규칙을
  // 그대로 따라가서 사용자가 어디서 열었는지 단번에 알게 한다.
  const displayName = codeName && codeName !== prmtCd ? codeName : prmtCd;

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`prompt: ${displayName}`}
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
              PROMPT
            </span>
            <span
              className="truncate text-[13px] font-semibold text-foreground"
              title={prmtCd}
            >
              {displayName}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {prmtCd}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {prompt.length.toLocaleString()}자
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "복사됨" : "복사"}
            </button>
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
        </div>
        <div className="flex-1 overflow-auto bg-background p-5">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
            {prompt}
          </pre>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
