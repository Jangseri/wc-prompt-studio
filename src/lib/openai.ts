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

/**
 * Lazy-init OpenAI client.
 *
 * Constructing `new OpenAI(...)` at module load throws if
 * OPENAI_API_KEY is missing. That kills `next build` during page-data
 * collection (the build container doesn't see compose's env_file —
 * that's runtime-only). Same risk for any other env where the key is
 * deliberately absent at import time.
 *
 * Solution: defer construction until the first property access. The
 * exported `openai` is a Proxy that materialises the real client on
 * demand, then forwards every property access to it. Call sites
 * (`openai.chat.completions.create(...)`) work unchanged.
 */
let cached: OpenAI | null = null;

function getClient(): OpenAI {
  if (cached) return cached;
  if (mockMode) {
    cached = createMockClient() as unknown as OpenAI;
    return cached;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local (or your deployment env)."
    );
  }
  cached = new OpenAI({ apiKey });
  return cached;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
