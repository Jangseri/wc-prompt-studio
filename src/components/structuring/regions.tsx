"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStructuringStore } from "@/stores/structuring-store";
import type {
  RoleRegion,
  PersonaRegion,
  CompanyInfoRegion,
  AnswerScopeRegion,
  BranchingRegion,
  ToolCallingRegion,
  SystemRegion,
  ConversationRegion,
} from "@/types/structuring";
import { CONVERSATION_RULE_TEXT } from "./lib/rules";
import { Field, TextInput, TextArea, Checkbox } from "./fields";

export function RoleSection({ value }: { value: RoleRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <Field label="Role 정의" hint="AI의 역할과 책임">
      <TextArea
        value={value.content}
        onChange={(v) => update("role", () => ({ content: v }))}
        placeholder="예: 고객사 상담 업무를 담당하는 AI 상담원입니다."
        rows={3}
      />
    </Field>
  );
}

export function PersonaSection({ value }: { value: PersonaRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <div className="space-y-3">
      <Field label="Language">
        <TextInput
          value={value.language}
          onChange={(v) => update("persona", (c) => ({ ...c, language: v }))}
          placeholder="예: 한국어"
        />
      </Field>
      <Field label="어투 (Tone)">
        <TextArea
          value={value.tone}
          onChange={(v) => update("persona", (c) => ({ ...c, tone: v }))}
          placeholder="예: 친근하지만 정중한 존댓말, 간결한 문장"
          rows={2}
        />
      </Field>
    </div>
  );
}

export function CompanyInfoSection({ value }: { value: CompanyInfoRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <div className="space-y-3">
      <Field label="업무 및 회사 정보">
        <TextArea
          value={value.description}
          onChange={(v) => update("companyInfo", (c) => ({ ...c, description: v }))}
          placeholder="회사명, 사업 영역, 서비스 대상 등"
          rows={3}
        />
      </Field>
      <Field label="인사말">
        <TextArea
          value={value.greeting}
          onChange={(v) => update("companyInfo", (c) => ({ ...c, greeting: v }))}
          placeholder="예: 안녕하세요, ○○입니다. 무엇을 도와드릴까요?"
          rows={2}
        />
      </Field>
    </div>
  );
}

export function AnswerScopeSection({ value }: { value: AnswerScopeRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  const { addKeyValueItem, updateKeyValueItem, removeKeyValueItem } = useStructuringStore();

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
        <Checkbox
          checked={value.rag.enabled}
          onChange={(v) =>
            update("answerScope", (c) => ({ ...c, rag: { ...c.rag, enabled: v } }))
          }
          label="RAG 사용"
        />
        {value.rag.enabled && (
          <Field label="성능 개선 사항" hint="필수">
            <TextArea
              value={value.rag.performanceNotes}
              onChange={(v) =>
                update("answerScope", (c) => ({
                  ...c,
                  rag: { ...c.rag, performanceNotes: v },
                }))
              }
              placeholder="예: 검색 결과 상위 3개만 활용, 유사도 임계값 0.7"
              rows={2}
            />
          </Field>
        )}
      </div>

      <div className="space-y-2">
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
          <div className="space-y-2">
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
          <TextArea
            value={value.specifics.sentence}
            onChange={(v) =>
              update("answerScope", (c) => ({
                ...c,
                specifics: { ...c.specifics, sentence: v },
              }))
            }
            placeholder="자연어 문장으로 지정할 내용을 입력..."
            rows={3}
          />
        )}
      </div>
    </div>
  );
}

export function BranchingSection({ value }: { value: BranchingRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <div className="space-y-3">
      <Field label="업무 유형 / 시간 분기">
        <TextArea
          value={value.description}
          onChange={(v) => update("branching", (c) => ({ ...c, description: v }))}
          placeholder="예: 영업시간 내에는 상담 연결, 외에는 콜백 접수"
          rows={2}
        />
      </Field>
      <Field label="Pseudo Code" hint="분기 로직 의사코드">
        <TextArea
          value={value.pseudoCode}
          onChange={(v) => update("branching", (c) => ({ ...c, pseudoCode: v }))}
          placeholder={"if (business_hours) {\n  connect_agent();\n} else {\n  collect_callback();\n}"}
          rows={6}
          mono
        />
      </Field>
    </div>
  );
}

export function ToolCallingSection({ value }: { value: ToolCallingRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <div className="space-y-3">
      <Field label="MCP">
        <TextArea
          value={value.mcp}
          onChange={(v) => update("toolCalling", (c) => ({ ...c, mcp: v }))}
          placeholder="MCP 서버 / 도구 호출 규칙"
          rows={2}
        />
      </Field>
      <Field label="API">
        <TextArea
          value={value.api}
          onChange={(v) => update("toolCalling", (c) => ({ ...c, api: v }))}
          placeholder="외부 API 호출 규칙"
          rows={2}
        />
      </Field>
      <Field label="Agent">
        <TextArea
          value={value.agent}
          onChange={(v) => update("toolCalling", (c) => ({ ...c, agent: v }))}
          placeholder="하위 Agent 호출 규칙"
          rows={2}
        />
      </Field>
      <Field label="Data Query">
        <TextArea
          value={value.dataQuery}
          onChange={(v) => update("toolCalling", (c) => ({ ...c, dataQuery: v }))}
          placeholder="DB 조회 규칙"
          rows={2}
        />
      </Field>
    </div>
  );
}

export function SystemSection({ value }: { value: SystemRegion }) {
  const update = useStructuringStore((s) => s.updateRegion);
  return (
    <Field label="STT / TTS 규칙" hint="음성 인식/합성 관련">
      <TextArea
        value={value.sttTts}
        onChange={(v) => update("system", () => ({ sttTts: v }))}
        placeholder="예: 숫자는 '일이삼'이 아닌 '123'으로 인식, 전화번호는 한 자리씩 발화"
        rows={4}
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
      <Field label="추가 사항" hint="선택">
        <TextArea
          value={value.customNotes}
          onChange={(v) => update("conversation", (c) => ({ ...c, customNotes: v }))}
          placeholder="위 규칙 외 대화 유지 관련 지침"
          rows={2}
        />
      </Field>
    </div>
  );
}
