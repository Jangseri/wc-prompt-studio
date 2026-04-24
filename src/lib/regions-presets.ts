import type { StructuringPrompt } from "@/types/structuring";

/**
 * Default STT/TTS rules that the server always writes into
 * `system.sttTts` after draft generation. The LLM is instructed to
 * leave the field empty — this constant is the single source of truth.
 * Users may edit the text freely in the UI afterwards.
 */
export const DEFAULT_STT_TTS_RULES = `1. [TTS] 표현 규칙
- 숫자·영문·기호는 모두 자연스러운 한국어 표현으로 변환합니다.
    - 시간·간격·주수 등 단위가 붙으면 **일·이·삼…(음독)**으로 변환.
    - 횟수·개수는 한·두·세… 또는 자연스러운 음독으로 변환.
- 줄바꿈(\\n)과 같은 음성 답변에 맞지 않는 특수 기호는 사용하지 않습니다.
- URL·웹사이트·이메일은 절대 안내하지 않습니다.
- 발음·전사 오류는 문맥에 맞게 의미 보정 후 응답합니다.

2. [STT] 문의 유형 분류 규칙
문의 분류를 요청한 상황에서, 고객 발화에 사전 정의된 문의 유형 후보군 중 하나로 유추 가능한 의미 단서가 일부라도 포함되어 있으면 가장 가능성이 높은 문의 유형으로 판단한다. 고객 발화는 STT 전사 오류로 인해 발음이나 단어가 왜곡될 수 있음을 전제로 해석한다.

3. [STT] 음운 유사성 기반 엔티티 매핑 규칙
엔티티 파악 맥락(예: 제조회사, 브랜드, 서비스명 등)에서, 고객 발화가 사전 정의된 엔티티 후보군의 항목과 음운적으로 유사하면(초성, 중성, 종성 중 1~2개만 다른 경우) 해당 항목으로 분류한다.
음운 유사성의 판단 기준은 다음과 같다.
(1) 초성, 중성, 종성 중 일부 탈락
(2) 한두 음절 치환
(3) 받침 탈락
(4) 조사 및 어미 부착
(5) 축약 또는 부분 발화
단, 다음 조건을 모두 충족해야 매핑을 확정한다.
- 발화가 두 음절 이상일 것
- 특정 후보와 발음 또는 음절 구조가 명확히 유사할 것
- 여러 후보 중 하나가 다른 후보보다 명확히 더 유사할 것
고객 발화가 왜곡되더라도 사전 정의된 후보군의 항목과 음운적으로 유사한 경우에만 매핑하며, 그 외에는 임의로 유추하지 않는다.

4. [STT] 입력 해석 규칙
고객 발화에 발음, 전사 오류, 단어 왜곡, 축약이 있더라도 특정 의도가 보이면 문맥 기준으로 보정하여 해석한다. 문의 분류를 요청한 상황에서, 고객 발화에 사전 정의된 문의 유형 후보군 중 하나로 유추 가능한 의미 단서가 일부라도 포함되어 있으면 가장 가능성이 높은 유형으로 판단한다.
다만, 고객 발화가 아래에 해당하는 경우에는 유추하지 않고 의미 확인 질문을 수행한다.
(1) 사람 이름이나 자기소개로 해석되는 발화
(2) 감탄사, 불만 표현, 추임새 등 문의 분류 의도가 없는 발화
(3) 의미 단서 없이 단음절 또는 무의미한 음절로만 구성된 발화
위 조건에 해당하지 않는 경우에는 판단이 불확실하더라도 대화 흐름을 유지하는 방향으로 최대한 분류하여 진행한다.`;

/**
 * Input-info blocks that are prepended to `companyInfo.description` by
 * the server for well-known industries. These are a "fixed" contract
 * with downstream prompt consumers — AA2001/2002/2003 are resolved at
 * runtime into customer/company/department data.
 *
 * For custom industries (직접입력), no preset applies.
 */
export const INDUSTRY_INPUT_INFO_BLOCKS: Record<string, string> = {
  병원: `[입력 정보]
- 고객정보
AA2002

- 부서별 영업 상태
AA2003`,
  일반: `[입력 정보]
- 전화한 고객 정보
AA2002

- 문의 접수 받는 기업/브랜드 정보
AA2001

- 기업/브랜드 영업 상태
AA2003`,
};

export function getIndustryInputInfoBlock(industry: string): string | null {
  return INDUSTRY_INPUT_INFO_BLOCKS[industry] ?? null;
}

/**
 * Prepend the industry's [입력 정보] block to companyInfo.description.
 * Idempotent — if the description already starts with the preset block
 * (e.g. the LLM included it despite our system-prompt guidance), no
 * change is made.
 */
export function applyIndustryPreset(
  structuring: StructuringPrompt,
  industry: string
): StructuringPrompt {
  const block = getIndustryInputInfoBlock(industry);
  if (!block) return structuring;

  const current = structuring.companyInfo.description ?? "";
  if (current.trimStart().startsWith(block)) return structuring;

  const merged = current.trim().length > 0 ? `${block}\n\n${current}` : block;

  return {
    ...structuring,
    companyInfo: {
      ...structuring.companyInfo,
      description: merged,
    },
  };
}
