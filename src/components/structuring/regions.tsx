"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, Maximize2, Save, X, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStructuringStore } from "@/stores/structuring-store";
import type {
  RoleRegion,
  PersonaRegion,
  CompanyInfoRegion,
  AnswerScopeRegion,
  BranchingRegion,
  BranchingStep,
  ToolCallingRegion,
  SystemRegion,
  ConversationRegion,
  CustomRegion,
} from "@/types/structuring";
import { CONVERSATION_RULE_TEXT } from "./lib/rules";
import { Field, TextInput, TextArea, Checkbox } from "./fields";

export function RoleSection({ value }: { value: RoleRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <Field
      label="Role 정의"
      hint="AI의 역할과 책임"
      className="flex h-full flex-col"
    >
      <TextArea
        value={value.content}
        onChange={(v) => update("role", () => ({ content: v }))}
        placeholder="예: 고객사 상담 업무를 담당하는 AI 상담원입니다."
        fill
      />
    </Field>
  );
}

export function PersonaSection({ value }: { value: PersonaRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <div className="flex h-full flex-col space-y-3">
      <Field label="Language">
        <TextInput
          value={value.language}
          onChange={(v) => update("persona", (c) => ({ ...c, language: v }))}
          placeholder="예: 한국어"
        />
      </Field>
      <Field label="어투 (Tone)" className="flex min-h-0 flex-1 flex-col">
        <TextArea
          value={value.tone}
          onChange={(v) => update("persona", (c) => ({ ...c, tone: v }))}
          placeholder="예: 친근하지만 정중한 존댓말, 간결한 문장"
          fill
        />
      </Field>
    </div>
  );
}

export function CompanyInfoSection({ value }: { value: CompanyInfoRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <div className="flex h-full flex-col space-y-3">
      <Field label="업무 및 회사 정보">
        <TextArea
          value={value.description}
          onChange={(v) => update("companyInfo", (c) => ({ ...c, description: v }))}
          placeholder="회사명, 사업 영역, 서비스 대상 등"
          rows={5}
        />
      </Field>
      <Field label="인사말" className="flex min-h-0 flex-1 flex-col">
        <TextArea
          value={value.greeting}
          onChange={(v) => update("companyInfo", (c) => ({ ...c, greeting: v }))}
          placeholder="예: 안녕하세요, ○○입니다. 무엇을 도와드릴까요?"
          fill
        />
      </Field>
    </div>
  );
}

export function AnswerScopeSection({ value }: { value: AnswerScopeRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  const { addKeyValueItem, updateKeyValueItem, removeKeyValueItem } = useStructuringStore();

  return (
    <div className="flex h-full flex-col space-y-3">
      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
        RAG 활성 또는 특정 내용이 입력되면 최종 출력 최하단에{" "}
        <span className="font-mono text-primary">[답변 참고자료]</span> 블록으로 렌더링
      </div>
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <Checkbox
          checked={value.rag.enabled}
          onChange={(v) =>
            update("answerScope", (c) => ({ ...c, rag: { ...c.rag, enabled: v } }))
          }
          label="RAG 사용"
        />
      </div>

      <Field label="특정 내용 지정 방식">
        <div className="flex gap-2">
          {(["keyValue", "sentence"] as const).map((t) => (
            <button
              key={t}
              onClick={() =>
                update("answerScope", (c) => ({
                  ...c,
                  specifics: { ...c.specifics, type: t },
                }))
              }
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-smooth",
                value.specifics.type === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              )}
            >
              {t === "keyValue" ? "Key : Value" : "문장"}
            </button>
          ))}
        </div>
      </Field>

      {value.specifics.type === "keyValue" ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {value.specifics.keyValueItems.map((item) => (
            <div key={item.id} className="flex gap-2">
              <input
                type="text"
                value={item.key}
                onChange={(e) => updateKeyValueItem(item.id, { key: e.target.value })}
                placeholder="Key"
                className="w-32 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                value={item.value}
                onChange={(e) => updateKeyValueItem(item.id, { value: e.target.value })}
                placeholder="Value"
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => removeKeyValueItem(item.id)}
                className="rounded-md px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={addKeyValueItem}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-smooth"
          >
            <Plus className="h-3.5 w-3.5" />
            Key:Value 추가
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <TextArea
            value={value.specifics.sentence}
            onChange={(v) =>
              update("answerScope", (c) => ({
                ...c,
                specifics: { ...c.specifics, sentence: v },
              }))
            }
            placeholder="자연어 문장으로 지정할 내용을 입력..."
            fill
          />
        </div>
      )}
    </div>
  );
}

/**
 * Pure editor for a branching.steps list. Prop-driven so it can be
 * wired to either:
 *   - the store directly (inline card, auto-save) — see InlineBranchingStepsEditor
 *   - a local draft (expand modal, manual save) — see BranchingStepsExpandModal
 */
interface BranchingStepsEditorProps {
  steps: BranchingStep[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Omit<BranchingStep, "id">>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}

function BranchingStepsEditor({
  steps,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
}: BranchingStepsEditorProps) {
  return (
    <div className="space-y-2">
      {steps.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-[11px] text-muted-foreground">
          단계 없음 — 하단 버튼으로 추가하세요.
        </p>
      ) : (
        steps.map((step, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === steps.length - 1;
          return (
            <div
              key={step.id}
              className="rounded-md border border-border bg-card/40 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {idx + 1})
                </span>
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => onUpdate(step.id, { title: e.target.value })}
                  placeholder="단계 제목 — 예: 부서 확인"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-medium focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => onMove(step.id, "up")}
                  disabled={isFirst}
                  className="rounded-md px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-smooth"
                  title="위로 이동"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onMove(step.id, "down")}
                  disabled={isLast}
                  className="rounded-md px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-smooth"
                  title="아래로 이동"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onRemove(step.id)}
                  className="rounded-md px-1.5 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
                  title="단계 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <TextArea
                value={step.body}
                onChange={(v) => onUpdate(step.id, { body: v })}
                placeholder={
                  '→ 고객의 문의 내용에 따라 부서를 식별합니다.\n"저희 병원에 방문하신 적이 있나요?"\n\nIF <부서 = "closed">:\n\t→ 재연락 안내\n\t"현재는 OOO의 업무 시간이 아닙니다..."'
                }
                rows={2}
                mono
                tabIndent
                autoResize
              />
            </div>
          );
        })
      )}
      <button
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-smooth"
      >
        <Plus className="h-3.5 w-3.5" />
        단계 추가
      </button>
    </div>
  );
}

/** Inline (card) variant — wires the editor directly to the store so
 *  edits persist immediately (auto-save semantics). */
function InlineBranchingStepsEditor() {
  const steps = useStructuringStore((s) => s.prompt.branching.steps);
  const addBranchingStep = useStructuringStore((s) => s.addBranchingStep);
  const updateBranchingStep = useStructuringStore(
    (s) => s.updateBranchingStep
  );
  const removeBranchingStep = useStructuringStore(
    (s) => s.removeBranchingStep
  );
  const moveBranchingStep = useStructuringStore((s) => s.moveBranchingStep);

  return (
    <BranchingStepsEditor
      steps={steps}
      onAdd={addBranchingStep}
      onUpdate={updateBranchingStep}
      onRemove={removeBranchingStep}
      onMove={moveBranchingStep}
    />
  );
}

/**
 * Expand modal — edits a local draft and commits to the store only when
 * the user clicks "저장". Closing with unsaved changes asks for
 * confirmation so edits aren't lost on accidental ESC.
 */
function BranchingStepsExpandModal({ onClose }: { onClose: () => void }) {
  const storeSteps = useStructuringStore((s) => s.prompt.branching.steps);

  // Deep-copy the snapshot once on mount so later store edits (auto-save
  // on the inline editor) don't bleed into the modal's draft.
  const [draft, setDraft] = useState<BranchingStep[]>(() =>
    storeSteps.map((s) => ({ ...s }))
  );
  // Snapshot taken once on mount; the modal closes on save, so we
  // never re-baseline mid-session.
  const [savedSnapshot] = useState(() => JSON.stringify(storeSteps));

  const dirty = useMemo(
    () => JSON.stringify(draft) !== savedSnapshot,
    [draft, savedSnapshot]
  );

  const handleClose = () => {
    if (dirty) {
      const ok = window.confirm(
        "저장하지 않은 변경이 있습니다. 버리고 닫으시겠습니까?"
      );
      if (!ok) return;
    }
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // handleClose closes over `dirty`; effect reruns when dirtiness changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const draftActions = useMemo(
    () => ({
      onAdd: () =>
        setDraft((d) => [...d, { id: nanoid(), title: "", body: "" }]),
      onUpdate: (id: string, patch: Partial<Omit<BranchingStep, "id">>) =>
        setDraft((d) =>
          d.map((s) => (s.id === id ? { ...s, ...patch } : s))
        ),
      onRemove: (id: string) =>
        setDraft((d) => d.filter((s) => s.id !== id)),
      onMove: (id: string, direction: "up" | "down") =>
        setDraft((d) => {
          const idx = d.findIndex((s) => s.id === id);
          if (idx < 0) return d;
          const target = direction === "up" ? idx - 1 : idx + 1;
          if (target < 0 || target >= d.length) return d;
          const next = d.slice();
          [next[idx], next[target]] = [next[target], next[idx]];
          return next;
        }),
    }),
    []
  );

  const handleSave = () => {
    useStructuringStore.setState((state) => ({
      prompt: {
        ...state.prompt,
        branching: { ...state.prompt.branching, steps: draft },
      },
    }));
    toast.success("저장되었습니다");
    // Save-and-close: commit then dismiss the modal. Skip the dirty
    // guard since we just matched store ← draft.
    onClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">대화 흐름 단계</h3>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              변경은 <span className="font-medium">저장 버튼</span>을 눌러야 반영됩니다. ESC / 우상단 닫기 버튼으로 닫기.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-smooth",
                dirty
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              title={dirty ? "변경 사항 저장" : "변경 사항 없음"}
            >
              <Save className="h-3.5 w-3.5" />
              {dirty ? "저장" : "저장됨"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-1.5 text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
              title="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <BranchingStepsEditor steps={draft} {...draftActions} />
        </div>
      </div>
    </div>,
    document.body
  );
}

export function BranchingSection({ value }: { value: BranchingRegion }) {
  const addBranchingRule = useStructuringStore((s) => s.addBranchingRule);
  const updateBranchingRule = useStructuringStore((s) => s.updateBranchingRule);
  const removeBranchingRule = useStructuringStore((s) => s.removeBranchingRule);

  const [stepsExpanded, setStepsExpanded] = useState(false);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Top-level rules (rendered at the top of the output, before any step) */}
      <Field label="절대 금지 규칙" hint="대화 시작 전 반드시 지킬 규칙">
        <div className="space-y-1.5">
          {value.topLevelRules.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              규칙 없음 — 하단 버튼으로 추가할 수 있습니다.
            </p>
          ) : (
            value.topLevelRules.map((rule, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="mt-2 shrink-0 text-muted-foreground">·</span>
                <input
                  type="text"
                  value={rule}
                  onChange={(e) => updateBranchingRule(idx, e.target.value)}
                  placeholder="예: 업무시간 외에는 상담원 연결 금지"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => removeBranchingRule(idx)}
                  className="rounded-md px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
                  title="규칙 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
          <button
            onClick={addBranchingRule}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-smooth"
          >
            <Plus className="h-3 w-3" />
            규칙 추가
          </button>
        </div>
      </Field>

      {/* Ordered steps — the main branching flow */}
      <Field
        label="대화 흐름 단계"
        hint="순서대로 진행되는 단계"
        className="flex min-h-0 flex-1 flex-col"
        action={
          <button
            type="button"
            onClick={() => setStepsExpanded(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background/80 px-2 py-1 text-[10px] text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground"
            title="확장해서 편집"
          >
            <Maximize2 className="h-3 w-3" />
            확장
          </button>
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <InlineBranchingStepsEditor />
        </div>
      </Field>

      {stepsExpanded && (
        <BranchingStepsExpandModal onClose={() => setStepsExpanded(false)} />
      )}
    </div>
  );
}

export function ToolCallingSection({ value }: { value: ToolCallingRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-500">
        Tool 호출 규칙은 아직 준비 중입니다. 편집과 최종 출력 모두 비활성화되어 있습니다.
      </div>
      <Field label="MCP">
        <TextArea
          value={value.mcp}
          onChange={(v) => update("toolCalling", (c) => ({ ...c, mcp: v }))}
          placeholder="MCP 서버 / 도구 호출 규칙"
          rows={3}
          disabled
        />
      </Field>
      <Field label="API">
        <TextArea
          value={value.api}
          onChange={(v) => update("toolCalling", (c) => ({ ...c, api: v }))}
          placeholder="외부 API 호출 규칙"
          rows={3}
          disabled
        />
      </Field>
      <Field label="Agent">
        <TextArea
          value={value.agent}
          onChange={(v) => update("toolCalling", (c) => ({ ...c, agent: v }))}
          placeholder="하위 Agent 호출 규칙"
          rows={3}
          disabled
        />
      </Field>
      <Field label="Data Query">
        <TextArea
          value={value.dataQuery}
          onChange={(v) => update("toolCalling", (c) => ({ ...c, dataQuery: v }))}
          placeholder="DB 조회 규칙"
          rows={3}
          disabled
        />
      </Field>
    </div>
  );
}

export function SystemSection({ value }: { value: SystemRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  // STT/TTS is server-provided standard rules — edits should be
  // intentional. Locked by default; user clicks "수정" to unlock the
  // textarea. Local state so closing/reopening the card re-locks.
  const [unlocked, setUnlocked] = useState(false);
  return (
    <Field
      label="STT / TTS 규칙"
      hint="음성 인식/합성 관련"
      className="flex h-full flex-col"
      action={
        <button
          type="button"
          onClick={() => setUnlocked((v) => !v)}
          title={unlocked ? "잠금" : "수정 허용"}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-smooth",
            unlocked
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          {unlocked ? (
            <Unlock className="h-3 w-3" />
          ) : (
            <Lock className="h-3 w-3" />
          )}
          {unlocked ? "잠금" : "수정"}
        </button>
      }
    >
      {!unlocked && (
        <div className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-500">
          ⚠️ 이 영역은 기본 제공되는 STT/TTS 규칙입니다. 수정 시 주의하세요.
        </div>
      )}
      <TextArea
        value={value.sttTts}
        onChange={(v) => update("system", () => ({ sttTts: v }))}
        placeholder="예: 숫자는 '일이삼'이 아닌 '123'으로 인식, 전화번호는 한 자리씩 발화"
        fill
        disabled={!unlocked}
      />
    </Field>
  );
}

export function ConversationSection({ value }: { value: ConversationRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <div className="space-y-3">
      <Field label="대화 유지 규칙" hint="체크한 항목만 프롬프트에 반영">
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          {(Object.keys(CONVERSATION_RULE_TEXT) as Array<keyof typeof CONVERSATION_RULE_TEXT>).map(
            (key) => (
              <Checkbox
                key={key}
                checked={value.rules[key]}
                onChange={(v) =>
                  update("conversation", (c) => ({
                    ...c,
                    rules: { ...c.rules, [key]: v },
                  }))
                }
                label={CONVERSATION_RULE_TEXT[key]}
              />
            )
          )}
        </div>
      </Field>
    </div>
  );
}

export function CustomSection({ value }: { value: CustomRegion }) {
  const {
    addCustomSection,
    updateCustomSection,
    removeCustomSection,
  } = useStructuringStore();

  return (
    <div className="flex h-full flex-col gap-3">
      <p className="shrink-0 text-[11px] text-muted-foreground">
        섹션 제목(태그)과 내용을 직접 작성합니다. 태그와 내용 둘 다 채워진
        항목만 최종 출력에 포함됩니다.
      </p>

      {value.items.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
          아직 항목이 없습니다. 아래 버튼으로 추가하세요.
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {value.items.map((item, idx) => (
            <div
              key={item.id}
              className="rounded-md border border-border bg-card/40 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
                  #{idx + 1}
                </span>
                <div className="flex-1">
                  <TextInput
                    value={item.tag}
                    onChange={(v) => updateCustomSection(item.id, { tag: v })}
                    placeholder="섹션 제목(태그) — 예: 주의 사항"
                  />
                </div>
                <button
                  onClick={() => removeCustomSection(item.id)}
                  className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
                  title="항목 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <TextArea
                value={item.content}
                onChange={(v) => updateCustomSection(item.id, { content: v })}
                placeholder="이 섹션의 내용을 작성하세요"
                rows={4}
              />
            </div>
          ))}
        </div>
      )}

      <button
        onClick={addCustomSection}
        className="shrink-0 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-smooth"
      >
        <Plus className="h-3.5 w-3.5" />
        항목 추가
      </button>
    </div>
  );
}
