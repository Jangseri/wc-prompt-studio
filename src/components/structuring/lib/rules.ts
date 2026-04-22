import type { ConversationRegion } from "@/types/structuring";

export const CONVERSATION_RULE_TEXT: Record<keyof ConversationRegion["rules"], string> = {
  rejectOutOfScope: "보유한 정보에 벗어나는 질문에는 답변하지 말고 재질의한다.",
  noReAskCollected: "이미 수집한 정보는 다시 질문하지 않는다.",
  oneQuestionAtATime: "한 번에 하나의 질문만 한다.",
  noInference: "보유하지 않은 정보를 추론하여 답변하지 않는다.",
  restrictedInfoOnly: "제한된 정보 범위 내에서만 답변한다.",
};

export function activeConversationRules(region: ConversationRegion): string[] {
  return (Object.keys(CONVERSATION_RULE_TEXT) as (keyof ConversationRegion["rules"])[])
    .filter((key) => region.rules[key])
    .map((key) => CONVERSATION_RULE_TEXT[key]);
}
