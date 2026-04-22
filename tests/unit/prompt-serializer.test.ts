import { describe, it, expect } from "vitest";
import {
  serialize,
  deserialize,
  isSerialized,
  SERIALIZER_VERSION,
  PromptSerializerError,
} from "@/lib/prompt-serializer";
import type { StructuringPrompt } from "@/types/structuring";

function makeFixture(overrides: Partial<StructuringPrompt> = {}): StructuringPrompt {
  return {
    role: { content: "AI 콜봇 상담사" },
    persona: { language: "한국어", tone: "정중한 존댓말" },
    companyInfo: {
      description: "A 병원의 예약 안내 봇",
      greeting: "안녕하세요, 예약을 도와드립니다.",
    },
    answerScope: {
      rag: { enabled: true, performanceNotes: "벡터 DB, top_k=5" },
      specifics: {
        type: "keyValue",
        keyValueItems: [
          { id: "kv-1", key: "영업시간", value: "09:00-18:00" },
          { id: "kv-2", key: "주소", value: '서울시 "강남구"' },
        ],
        sentence: "",
      },
    },
    branching: {
      description: "진료/예약/문의 3개 분기",
      pseudoCode: "if intent == '예약' => ...",
    },
    toolCalling: { mcp: "", api: "", agent: "", dataQuery: "" },
    system: { sttTts: "Clova STT + Polly TTS" },
    conversation: {
      rules: {
        rejectOutOfScope: true,
        noReAskCollected: true,
        oneQuestionAtATime: false,
        noInference: true,
        restrictedInfoOnly: false,
      },
      customNotes: "줄바꿈\n포함\n여러\n줄",
    },
    ...overrides,
  };
}

describe("serialize / deserialize roundtrip", () => {
  it("round-trips a populated fixture 1:1", () => {
    const input = makeFixture();
    const out = deserialize(serialize(input));
    expect(out).toEqual(input);
  });

  it("round-trips unicode and special chars intact", () => {
    const input = makeFixture({
      role: { content: "🎯 상담사 <script>alert('xss')</script> & \"특수\" 문자" },
    });
    expect(deserialize(serialize(input)).role).toEqual(input.role);
  });

  it("round-trips empty strings and empty arrays", () => {
    const input = makeFixture({
      answerScope: {
        rag: { enabled: false, performanceNotes: "" },
        specifics: { type: "sentence", keyValueItems: [], sentence: "" },
      },
    });
    expect(deserialize(serialize(input))).toEqual(input);
  });

  it("produced output contains the header and all region markers", () => {
    const output = serialize(makeFixture());
    expect(output.startsWith(`<!-- STUDIO:${SERIALIZER_VERSION} -->`)).toBe(true);
    for (const id of [
      "role",
      "persona",
      "companyInfo",
      "answerScope",
      "branching",
      "toolCalling",
      "system",
      "conversation",
    ]) {
      expect(output).toContain(`<!-- REGION:${id} -->`);
      expect(output).toContain(`<!-- /REGION:${id} -->`);
    }
  });
});

describe("deserialize error handling", () => {
  it("rejects input missing the STUDIO header", () => {
    expect(() => deserialize("no header here")).toThrow(PromptSerializerError);
  });

  it("rejects unsupported version", () => {
    const bogus = "<!-- STUDIO:v99 -->\n<!-- REGION:role -->\n{}\n<!-- /REGION:role -->";
    expect(() => deserialize(bogus)).toThrowError(/unsupported version/);
  });

  it("rejects when a region is missing", () => {
    const input = makeFixture();
    const serialized = serialize(input);
    const mangled = serialized.replace(/<!-- REGION:role -->[\s\S]*?<!-- \/REGION:role -->/, "");
    expect(() => deserialize(mangled)).toThrowError(/missing region "role"/);
  });

  it("rejects when a region has invalid JSON", () => {
    const broken = [
      `<!-- STUDIO:${SERIALIZER_VERSION} -->`,
      "",
      "<!-- REGION:role -->",
      "{ not json",
      "<!-- /REGION:role -->",
    ].join("\n");
    expect(() => deserialize(broken)).toThrowError(/invalid JSON in region "role"/);
  });

  it("rejects non-string input", () => {
    expect(() => deserialize(null as unknown as string)).toThrow(PromptSerializerError);
    expect(() => deserialize(42 as unknown as string)).toThrow(PromptSerializerError);
  });
});

describe("isSerialized", () => {
  it("returns true for serializer output", () => {
    expect(isSerialized(serialize(makeFixture()))).toBe(true);
  });

  it("returns false for arbitrary strings", () => {
    expect(isSerialized("just some prompt text")).toBe(false);
    expect(isSerialized("")).toBe(false);
  });
});
