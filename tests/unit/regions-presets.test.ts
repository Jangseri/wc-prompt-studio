import { describe, it, expect } from "vitest";
import {
  getIndustryInputInfoBlock,
  applyIndustryPreset,
  DEFAULT_STT_TTS_RULES,
} from "@/lib/regions-presets";
import type { StructuringPrompt } from "@/types/structuring";

function baseStructuring(overrides?: Partial<StructuringPrompt>): StructuringPrompt {
  return {
    role: { content: "" },
    persona: { language: "", tone: "" },
    companyInfo: { description: "", greeting: "" },
    answerScope: {
      rag: { enabled: false, performanceNotes: "" },
      specifics: { type: "keyValue", keyValueItems: [], sentence: "" },
    },
    branching: { topLevelRules: [], steps: [] },
    toolCalling: { mcp: "", api: "", agent: "", dataQuery: "" },
    system: { sttTts: "" },
    conversation: {
      rules: {
        rejectOutOfScope: false,
        noReAskCollected: false,
        oneQuestionAtATime: false,
        noInference: false,
        restrictedInfoOnly: false,
      },
      customNotes: "",
    },
    custom: { items: [] },
    ...overrides,
  };
}

describe("getIndustryInputInfoBlock", () => {
  it("returns the 병원 template", () => {
    const block = getIndustryInputInfoBlock("병원");
    expect(block).toContain("[입력 정보]");
    expect(block).toContain("- 고객정보\nAA2002");
    expect(block).toContain("- 부서별 영업 상태\nAA2003");
  });

  it("returns the 일반 template", () => {
    const block = getIndustryInputInfoBlock("일반");
    expect(block).toContain("[입력 정보]");
    expect(block).toContain("- 전화한 고객 정보\nAA2002");
    expect(block).toContain("- 문의 접수 받는 기업/브랜드 정보\nAA2001");
    expect(block).toContain("- 기업/브랜드 영업 상태\nAA2003");
  });

  it("returns null for unknown/custom industries", () => {
    expect(getIndustryInputInfoBlock("카페")).toBeNull();
    expect(getIndustryInputInfoBlock("")).toBeNull();
  });
});

describe("DEFAULT_STT_TTS_RULES", () => {
  it("contains all four numbered rule sections", () => {
    expect(DEFAULT_STT_TTS_RULES).toContain("1. [TTS] 표현 규칙");
    expect(DEFAULT_STT_TTS_RULES).toContain("2. [STT] 문의 유형 분류 규칙");
    expect(DEFAULT_STT_TTS_RULES).toContain(
      "3. [STT] 음운 유사성 기반 엔티티 매핑 규칙"
    );
    expect(DEFAULT_STT_TTS_RULES).toContain("4. [STT] 입력 해석 규칙");
  });
});

describe("applyIndustryPreset", () => {
  it("prepends the block with a blank separator when description is non-empty", () => {
    const s = baseStructuring({
      companyInfo: {
        description: "A병원은 여성 건강 전문 의료기관입니다.",
        greeting: "",
      },
    });
    const result = applyIndustryPreset(s, "병원");
    expect(result.companyInfo.description).toMatch(/^\[입력 정보\]/);
    expect(result.companyInfo.description).toContain(
      "\n\nA병원은 여성 건강 전문 의료기관입니다."
    );
  });

  it("uses the block alone when description is empty", () => {
    const s = baseStructuring();
    const result = applyIndustryPreset(s, "병원");
    expect(result.companyInfo.description).toBe(
      getIndustryInputInfoBlock("병원")
    );
  });

  it("is idempotent when the description already starts with the block", () => {
    const s = baseStructuring();
    const once = applyIndustryPreset(s, "병원");
    const twice = applyIndustryPreset(once, "병원");
    expect(twice.companyInfo.description).toBe(once.companyInfo.description);
  });

  it("leaves the structuring unchanged for custom industries", () => {
    const s = baseStructuring({
      companyInfo: { description: "커스텀 업종 설명", greeting: "" },
    });
    const result = applyIndustryPreset(s, "카페");
    expect(result).toBe(s);
  });

  it("preserves other regions untouched", () => {
    const s = baseStructuring({
      role: { content: "역할" },
      persona: { language: "한국어", tone: "친근" },
    });
    const result = applyIndustryPreset(s, "일반");
    expect(result.role.content).toBe("역할");
    expect(result.persona.language).toBe("한국어");
    expect(result.persona.tone).toBe("친근");
  });
});
