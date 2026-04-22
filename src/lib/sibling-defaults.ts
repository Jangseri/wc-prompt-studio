import { SIBLING_PRMT_CDS, type SiblingPrmtCd } from "./prompt-codes";

export interface SiblingDefault {
  prompt: string;
  json_schema: string | null;
}

/**
 * Default payloads for the three sibling records that accompany every
 * unified-workspace apply (PA4000 / PA1000 / PC1000).
 *
 * Inserted with INSERT IGNORE per docs/unified-workspace-plan.md §6B.2,
 * so existing tuning on a (company_seq, ai_staff_seq, svc_cd, prmt_cd)
 * key is preserved across re-applies.
 *
 * PC1000's json_schema is a template that contains AA*** substitution
 * markers (e.g. AA2004 for the dept enum, AA3000 for the dialog block).
 * The marker substitution happens downstream at chat/consumption time,
 * not at write time, so we intentionally store the raw template here.
 */

const PA4000_PROMPT = `마지막 AI 상담원(assistant) message의 목적을 보고 아래 중 하나를 선택하라.
입력: 이전 고객(user)/AI 상담원(assistant) 대화와 마지막 AI 상담원(assistant) 발화가 함께 주어진다.
이전 대화는 맥락 참고용이며, 판단 근거는 오직 마지막 assistant message이다.

## dialog
- 고객 답변을 유도하는 문장 (예: "무엇을 도와드릴까요?", "문의 내용을 말씀해주세요.")
- 동의/확인 요청 질문 (예: "연결해드릴까요?", "접수 도와드릴까요?", "말씀해주시면 연결해드리겠습니다.")
- 안내/설명 후 대화를 이어가는 문장
- 말로 대답받을 정보 요청 (예: 이름, 문의 목적)
→ 일반 대화/안내/질문 = dialog

## reaction_transferCall
- 실제 상담원/담당자 연결을 실행하는 문장 (예: "담당자를 연결해드리겠습니다. 잠시만 기다려 주세요.")
- "연결 실행"을 의미하는 분명한 문장
- 이전 턴에서 고객이 동의/요청했고 이번 message가 연결 실행 문장인 경우
※ "연결해드릴까요?" = dialog / "연결해드리겠습니다" = reaction_transferCall

## reaction_getDtmf
- 키패드 입력을 요청하는 문장 (예: "전화번호를 키패드로 입력 후 우물정자를 눌러 주세요", "인증번호 네 자리 입력 후 샵 버튼을 눌러 주세요")
→ DTMF 입력 요청 = reaction_getDtmf

## reaction_saveReception
- 최종 확정/저장 완료 안내 문장 (예: "접수가 완료되었습니다.", "문의 내용을 접수해 두겠습니다.")
→ 접수 완료/저장 확정 안내 = reaction_saveReception

## reaction_disconnect
- 통화 종료 목적 (예: "도움이 되셨길 바랍니다. 감사합니다.", "이제 통화를 종료하겠습니다.", "이용해주셔서 감사합니다. 좋은 하루 되세요.", "다른 문의가 있으시면 언제든 연락 부탁드립니다. 감사합니다.")
→ 종료 안내/통화 끊기 = reaction_disconnect

## 출력 규칙 (엄격히 준수)
- 반드시 아래 5개 값 중 정확히 하나만 출력하라.
- 줄바꿈, 공백, 따옴표, 마크다운, 설명, 이유, 특수기호, 접두어, 접미어 등 어떤 추가 텍스트도 절대 포함하지 마라.
- 출력은 해당 값의 문자열 그 자체여야 한다. 값 앞뒤에 아무것도 붙이지 마라.
- 판단 근거나 이유를 절대 출력하지 마라.

허용되는 출력값:
dialog
reaction_transferCall
reaction_getDtmf
reaction_saveReception
reaction_disconnect

올바른 출력 예시: dialog
잘못된 출력 예시: "dialog", **dialog**, 결과: dialog, dialog입니다, 답변: dialog`;

const PA1000_PROMPT = `당신은 고객 상담 내용을 정리해주는 Assistant 입니다. 고객과 AI 상담사 간의 대화 내용을 바탕으로, 주어진 항목에 대해 체계적으로 정리하십시오.

목표:
대화 내용을 아래 항목들에 대해 구분하여 간결하고 명확하게 작성하십시오.

입력 데이터:
- 고객과 AI 상담사 간의 실제 통화 내용이 "text"로 제공됩니다.
- 대화 내용에 대한 화자 구분은 고객 "user", AI 상담사 "assistant"로 구분됩니다.

정리 가이드:
1. 대화를 정독하여 고객이 전달하고자 하는 핵심 문의 사항을 파악해야 합니다.
2. 정리하는 항목들은 "고객(user)"의 발화를 기반으로 작성해야 합니다.
3. 고객 발화 내용의 요청이나 불편사항, 문의의 본질이 무엇인지 한두 문장으로 요약하여 "문의 내용"에 작성합니다.
4. "접수자"와 "연락처"은 대화 중 AI 상담사의 요청에 답변하는 고객(user)의 응답으로만 작성합니다. 단, 응답으로 받지 않았거나 항목에 대한 내용이 없다면 "" 빈칸으로 답변해야 합니다.
5. 응답은 반드시 아래의 JSON 형식으로 출력해야 하며, 응답 형식 예시를 참고해야 합니다.

응답 형식:
{
  "접수자": "<고객이 응답한 내용>",
  "연락처": "<고객이 응답한 내용>",
  "문의 내용": "<고객의 문의 요약>"
}`;

const PA1000_JSON_SCHEMA = JSON.stringify({
  name: "FORM_LLM_01",
  strict: true,
  schema: {
    type: "object",
    properties: {
      접수자: {
        type: "string",
        description: "대화 중 고객이 명시적으로 언급한 본인 이름",
      },
      연락처: {
        type: "string",
        description: "대화 중 고객이 명시적으로 언급한 전화번호",
      },
      "문의 내용": {
        type: "string",
        description:
          "고객이 전화로 전달한 핵심 요청, 불편사항, 문의의 본질을 1~2문장으로 요약한 내용",
      },
    },
    required: ["접수자", "연락처", "문의 내용"],
    additionalProperties: false,
  },
});

const PC1000_PROMPT = `당신은 고객(user)과 AI 상담원(assistant)의 통화 음성 내용을 텍스트로 전사한 대화를 분석하여, 이 대화가 어느 부서에 접수되어야 하는지를 분류하는 역할을 맡고 있습니다.

유의사항:
- 입력되는 대화는 실제 통화 음성을 전사한 텍스트로, 문장이 완전하지 않거나 말투가 구어체일 수 있습니다.
- 전사 과정에서 반복, 중단, 불명확한 단어 등이 포함될 수 있으며, 이를 그대로 분석해야 합니다.
- 문장 구조보다는 **의미, 의도, 맥락**을 중심으로 이해해야 합니다.

규칙:
1. 당신의 임무는 고객의 발화와 상담원의 응답을 모두 읽고, 대화의 핵심 주제와 고객의 요청 의도를 정확히 파악하여 그 내용이 가장 적절하게 속하는 부서를 선택하는 것입니다.
2. 다음 중 반드시 하나만 선택합니다: AA2004
3. 각 부서는 회사의 서비스나 업무 영역에 따라 정의되며, 그 의미는 변동될 수 있습니다. 부서 이름만을 근거로 대화의 주제와 관련성이 가장 높은 부서를 판단해야 합니다.
4. "기본" 부서는 다른 어느 부서에도 명확히 속하지 않거나 분류가 애매한 경우에만 선택합니다. "기본"은 최후의 수단으로 사용해야 합니다.

판단 시 고려할 요소:
- **키워드 기반 판단:**
  고객이 언급하는 주요 단어, 서비스명, 요청 유형(예: 예약, 문의, 불만, 취소, 환불 등), 상품명, 지역명 등 명시적 표현을 우선적으로 파악합니다.
- **문맥 기반 판단:**
  불완전한 문장이라도 대화의 전체 흐름, 상담원의 응답, 고객의 어조나 표현 의도를 종합하여 진짜 목적을 파악합니다.
  단어 단위보다 의미 단위로 판단하십시오.
- **우선순위 판단:**
  여러 주제가 등장하더라도 고객이 가장 집중적으로 이야기하는 핵심 요청 또는 해결하고자 하는 문제를 기준으로 판단합니다.
- **명확성 기준:**
  특정 부서와의 관련성이 뚜렷할 경우 해당 부서를 선택하며, 모호하거나 중립적인 경우 "기본"으로 분류합니다.
- **노이즈 내성:**
  의미 없는 대화(인사, 잡담, 연결 대기 중 멘트 등)는 무시하고, 실제 요청 또는 문제 해결 의도에만 집중합니다.

출력:
- 반드시 **하나의 부서명만 반환합니다.**
- 출력 형식은 별도로 정의된 JSON Schema를 따릅니다.

[고객과 AI 상담원의 대화 내용]
AA3000`;

/**
 * NOTE: PC1000's json_schema is stored as a raw template string. The
 * `"enum": AA2004` fragment is an intentional substitution marker (not
 * valid JSON in isolation). Downstream code replaces AA*** markers with
 * the concrete dept enum at consumption time, so the stored value is
 * semantically a template, not a finalized JSON document.
 */
const PC1000_JSON_SCHEMA = `{
  "name": "dept_classification_response",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "dept": {
        "type": "string",
        "enum": AA2004,
        "description": "대화의 주제와 고객의 요청 의도에 따라 분류된 최종 부서명"
      }
    },
    "required": ["dept"],
    "additionalProperties": false
  }
}`;

export const SIBLING_DEFAULTS: Record<SiblingPrmtCd, SiblingDefault> = {
  PA4000: { prompt: PA4000_PROMPT, json_schema: null },
  PA1000: { prompt: PA1000_PROMPT, json_schema: PA1000_JSON_SCHEMA },
  PC1000: { prompt: PC1000_PROMPT, json_schema: PC1000_JSON_SCHEMA },
};

export function getSiblingDefault(prmtCd: SiblingPrmtCd): SiblingDefault {
  return SIBLING_DEFAULTS[prmtCd];
}

export function assertSiblingDefaultsComplete(): void {
  for (const cd of SIBLING_PRMT_CDS) {
    if (!SIBLING_DEFAULTS[cd]) {
      throw new Error(`sibling-defaults: missing entry for ${cd}`);
    }
  }
}
