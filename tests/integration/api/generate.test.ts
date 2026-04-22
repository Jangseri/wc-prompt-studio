import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openai", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

import { POST } from "@/app/api/generate/route";
import { openai } from "@/lib/openai";
import { _resetForTests as resetRateLimit } from "@/lib/rate-limit";

const mockCreate = openai.chat.completions.create as unknown as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown, ip = "203.0.113.1"): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockCreate.mockReset();
  resetRateLimit();
});

describe("POST /api/generate — input validation", () => {
  it("returns 400 when body is not valid JSON", async () => {
    const req = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.1.1.1" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for regions mode with invalid channel", async () => {
    const res = await POST(
      makeRequest({
        mode: "regions",
        parsedText: "x",
        channel: "telegram",
        industry: "병원",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/스키마/);
  });

  it("returns 400 for regions mode missing industry", async () => {
    const res = await POST(
      makeRequest({
        mode: "regions",
        parsedText: "x",
        channel: "callbot",
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/generate — regions mode happy path", () => {
  it("returns structuring payload when LLM emits schema-compliant JSON", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              role: { content: "AI 상담사" },
              persona: { language: "한국어", tone: "정중" },
              companyInfo: { description: "설명", greeting: "" },
              answerScope: {
                rag: { enabled: false, performanceNotes: "" },
                specifics: { type: "sentence", keyValueItems: [], sentence: "" },
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
            }),
          },
        },
      ],
    });

    const res = await POST(
      makeRequest({
        mode: "regions",
        parsedText: "source text",
        channel: "callbot",
        industry: "병원",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("regions");
    expect(body.structuring.role.content).toBe("AI 상담사");
    expect(body.structuring.persona.language).toBe("한국어");

    // Verify the request to OpenAI included the json_schema response_format
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.response_format?.type).toBe("json_schema");
    expect(callArgs.response_format?.json_schema?.name).toBe("structuring_prompt");
  });

  it("returns 502 when LLM returns non-JSON content", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "not valid json at all" } }],
    });
    const res = await POST(
      makeRequest({
        mode: "regions",
        parsedText: "x",
        channel: "chatbot",
        industry: "금융",
      })
    );
    expect(res.status).toBe(502);
  });
});

describe("POST /api/generate — legacy mode (no `mode` field)", () => {
  it("returns the legacy {prompt, sections, greetingMessage, warnings} shape", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "[도입부]\ntest\n---\n응답 기본 원칙\n---\n영업상태 판단 규칙\n---\n대화 흐름\n---\n통화 종료\n---\n예외 처리\n---\n[답변 참고자료]\nAA1000",
          },
        },
      ],
    });

    const res = await POST(
      makeRequest({
        parsedText: "anything",
        type: "general",
        textContent: "src",
        channel: "callbot",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.prompt).toBe("string");
    expect(body.sections).toBeDefined();
    expect(body.sections.responseRules).toBeDefined();
    expect(body.warnings).toBeInstanceOf(Array);
    expect(body.structuring).toBeUndefined();
  });
});

describe("POST /api/generate — rate limiting", () => {
  it("returns 429 once the IP burst is exhausted", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "x" } }],
    });

    const makeCall = () =>
      POST(
        makeRequest(
          { parsedText: "t", textContent: "t", type: "general", channel: "callbot" },
          "9.9.9.9"
        )
      );

    // RATE_LIMIT capacity is 10 in the route
    for (let i = 0; i < 10; i++) {
      const r = await makeCall();
      expect(r.status).not.toBe(429);
    }
    const r = await makeCall();
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).not.toBeNull();
  });
});
