import OpenAI from "openai";

/**
 * When OPENAI_MOCK=1 is set in the environment, the exported `openai`
 * client is a deterministic stub instead of a real SDK instance. Used by
 * Playwright E2E so /api/generate can be exercised without burning real
 * API credits. No effect in normal development or production.
 */
const mockMode = process.env.OPENAI_MOCK === "1";

const MOCK_STRUCTURING = {
  role: { content: "Mock AI 상담사" },
  persona: { language: "한국어", tone: "정중한 존댓말" },
  companyInfo: {
    description: "E2E 테스트용 회사 설명",
    greeting: "",
  },
  answerScope: {
    rag: { enabled: false, performanceNotes: "" },
    specifics: { type: "sentence", keyValueItems: [], sentence: "Mock answer scope" },
  },
  branching: { description: "", pseudoCode: "" },
  toolCalling: { mcp: "", api: "", agent: "", dataQuery: "" },
  system: { sttTts: "" },
  conversation: {
    rules: {
      rejectOutOfScope: true,
      noReAskCollected: true,
      oneQuestionAtATime: true,
      noInference: true,
      restrictedInfoOnly: true,
    },
    customNotes: "",
  },
};

const MOCK_LEGACY_CONTENT =
  "[도입부]\nMock 콜봇 도입부\n---\n응답 기본 원칙\n---\n영업상태 판단\n---\n대화 흐름\n---\n통화 종료\n---\n예외 처리\n---\n[답변 참고자료]\nAA1000";

type ChatCreateArgs = { response_format?: { type?: string } };

function createMockClient() {
  return {
    chat: {
      completions: {
        create: async (args: ChatCreateArgs) => {
          const isRegions = args?.response_format?.type === "json_schema";
          const content = isRegions
            ? JSON.stringify(MOCK_STRUCTURING)
            : MOCK_LEGACY_CONTENT;
          return {
            id: "chatcmpl-mock",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          };
        },
      },
    },
  };
}

export const openai = mockMode
  ? (createMockClient() as unknown as OpenAI)
  : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
