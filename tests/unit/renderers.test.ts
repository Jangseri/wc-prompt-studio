import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/components/structuring/lib/renderers/markdown";
import { renderXml } from "@/components/structuring/lib/renderers/xml";
import { renderGemini } from "@/components/structuring/lib/renderers/gemini";
import {
  shouldRenderReferenceBlock,
  renderReferenceBlock,
} from "@/components/structuring/lib/reference-block";
import type { StructuringPrompt } from "@/types/structuring";

function baseStructuring(overrides?: Partial<StructuringPrompt>): StructuringPrompt {
  return {
    role: { content: "역할 설명" },
    persona: { language: "한국어", tone: "정중" },
    companyInfo: { description: "회사 소개", greeting: "" },
    answerScope: {
      rag: { enabled: false, performanceNotes: "" },
      specifics: { type: "keyValue", keyValueItems: [], sentence: "" },
    },
    branching: { topLevelRules: [], steps: [] },
    toolCalling: { mcp: "", api: "", agent: "", dataQuery: "" },
    system: { rules: "" },
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

describe("shouldRenderReferenceBlock", () => {
  it("is false when RAG is off and specifics are empty", () => {
    expect(shouldRenderReferenceBlock(baseStructuring())).toBe(false);
  });

  it("is true when RAG is enabled", () => {
    const s = baseStructuring({
      answerScope: {
        rag: { enabled: true, performanceNotes: "" },
        specifics: { type: "keyValue", keyValueItems: [], sentence: "" },
      },
    });
    expect(shouldRenderReferenceBlock(s)).toBe(true);
  });

  it("is true when any keyValue item has content", () => {
    const s = baseStructuring({
      answerScope: {
        rag: { enabled: false, performanceNotes: "" },
        specifics: {
          type: "keyValue",
          keyValueItems: [{ id: "1", key: "진료시간", value: "9-18" }],
          sentence: "",
        },
      },
    });
    expect(shouldRenderReferenceBlock(s)).toBe(true);
  });

  it("is true when sentence has content", () => {
    const s = baseStructuring({
      answerScope: {
        rag: { enabled: false, performanceNotes: "" },
        specifics: {
          type: "sentence",
          keyValueItems: [],
          sentence: "문장형 안내",
        },
      },
    });
    expect(shouldRenderReferenceBlock(s)).toBe(true);
  });
});

describe("renderReferenceBlock", () => {
  it("produces just the title and AA1000 with no specifics", () => {
    const s = baseStructuring({
      answerScope: {
        rag: { enabled: true, performanceNotes: "" },
        specifics: { type: "keyValue", keyValueItems: [], sentence: "" },
      },
    });
    expect(renderReferenceBlock(s)).toBe("[답변 참고자료]\nAA1000");
  });

  it("includes keyValue items with a blank line before AA1000", () => {
    const s = baseStructuring({
      answerScope: {
        rag: { enabled: true, performanceNotes: "" },
        specifics: {
          type: "keyValue",
          keyValueItems: [
            { id: "1", key: "진료시간", value: "9-18" },
            { id: "2", key: "전화", value: "02-000-0000" },
          ],
          sentence: "",
        },
      },
    });
    expect(renderReferenceBlock(s)).toBe(
      "[답변 참고자료]\n- 진료시간: 9-18\n- 전화: 02-000-0000\n\nAA1000"
    );
  });

  it("includes sentence with a blank line before AA1000", () => {
    const s = baseStructuring({
      answerScope: {
        rag: { enabled: false, performanceNotes: "" },
        specifics: {
          type: "sentence",
          keyValueItems: [],
          sentence: "특정 안내 문장입니다.",
        },
      },
    });
    expect(renderReferenceBlock(s)).toBe(
      "[답변 참고자료]\n특정 안내 문장입니다.\n\nAA1000"
    );
  });
});

describe("renderer: branching (대화 흐름)", () => {
  const withBranching = baseStructuring({
    branching: {
      topLevelRules: [
        "신환 여부 답변 전에는 업무 시간 안내 금지",
        "이를 위반하면 오답",
      ],
      steps: [
        {
          id: "step-1",
          title: "부서 확인",
          body: "→ 고객 문의에 따라 부서 식별",
        },
        {
          id: "step-2",
          title: "신환 여부 확인",
          body: '"저희 병원에 방문하신 적이 있나요?"',
        },
      ],
    },
  });

  it("markdown renders rules as a bullet list and steps as numbered ### headers", () => {
    const out = renderMarkdown(withBranching);
    expect(out).toContain("## 대화 흐름");
    expect(out).toContain("### 절대 금지 규칙");
    expect(out).toContain("- 신환 여부 답변 전에는 업무 시간 안내 금지");
    expect(out).toContain("- 이를 위반하면 오답");
    expect(out).toContain("### 1) 부서 확인");
    expect(out).toContain("### 2) 신환 여부 확인");
    expect(out).toContain("→ 고객 문의에 따라 부서 식별");
    expect(out).toContain('"저희 병원에 방문하신 적이 있나요?"');
  });

  it("xml wraps everything in <branching> with <top_level_rules> and <steps>", () => {
    const out = renderXml(withBranching);
    expect(out).toContain("<branching>");
    expect(out).toContain("<top_level_rules>");
    expect(out).toContain("<rule>신환 여부 답변 전에는 업무 시간 안내 금지</rule>");
    expect(out).toContain('<step index="1" title="부서 확인">');
    expect(out).toContain('<step index="2" title="신환 여부 확인">');
    expect(out).toContain("</branching>");
  });

  it("gemini puts 대화 흐름 in a section() block with numbered h2 steps", () => {
    const out = renderGemini(withBranching);
    expect(out).toContain("# 대화 흐름");
    expect(out).toContain("## 절대 금지 규칙");
    expect(out).toContain("## 1) 부서 확인");
    expect(out).toContain("## 2) 신환 여부 확인");
  });

  it("all renderers skip steps where both title and body are empty", () => {
    const s = baseStructuring({
      branching: {
        topLevelRules: [],
        steps: [
          { id: "a", title: "", body: "" },
          { id: "b", title: "유효", body: "내용" },
        ],
      },
    });
    for (const out of [renderMarkdown(s), renderXml(s), renderGemini(s)]) {
      expect(out).toContain("유효");
      // Still numbered from position in array (2nd entry → "2)")
      expect(out).toMatch(/2\) 유효|index="2" title="유효"/);
    }
  });

  it("all renderers skip branching entirely when rules and steps are empty", () => {
    const out = renderMarkdown(baseStructuring());
    expect(out).not.toContain("## 대화 흐름");
    expect(out).not.toContain("절대 금지 규칙");
    const outXml = renderXml(baseStructuring());
    expect(outXml).not.toContain("<branching>");
    const outGemini = renderGemini(baseStructuring());
    expect(outGemini).not.toContain("대화 흐름");
  });

  it("xml escapes double-quotes in step titles", () => {
    const s = baseStructuring({
      branching: {
        topLevelRules: [],
        steps: [{ id: "a", title: `"quoted"`, body: "body" }],
      },
    });
    const out = renderXml(s);
    expect(out).toContain('title="&quot;quoted&quot;"');
  });
});

describe("renderer: toolCalling is skipped entirely", () => {
  it("markdown does not include Tool 호출 규칙 even if fields are populated", () => {
    const s = baseStructuring({
      toolCalling: {
        mcp: "mcp value",
        api: "api value",
        agent: "",
        dataQuery: "",
      },
    });
    const out = renderMarkdown(s);
    expect(out).not.toContain("Tool 호출 규칙");
    expect(out).not.toContain("mcp value");
    expect(out).not.toContain("api value");
  });

  it("xml does not include <tool_calling> even if fields are populated", () => {
    const s = baseStructuring({
      toolCalling: {
        mcp: "mcp value",
        api: "",
        agent: "",
        dataQuery: "",
      },
    });
    const out = renderXml(s);
    expect(out).not.toContain("<tool_calling>");
    expect(out).not.toContain("mcp value");
  });

  it("gemini does not include TOOL 호출 규칙 even if fields are populated", () => {
    const s = baseStructuring({
      toolCalling: {
        mcp: "mcp value",
        api: "",
        agent: "",
        dataQuery: "",
      },
    });
    const out = renderGemini(s);
    expect(out).not.toContain("TOOL 호출 규칙");
    expect(out).not.toContain("mcp value");
  });
});

describe("renderer: specifics move to the reference block", () => {
  it("markdown puts keyValue only in the bottom block, not in answerScope section", () => {
    const s = baseStructuring({
      answerScope: {
        rag: { enabled: false, performanceNotes: "" },
        specifics: {
          type: "keyValue",
          keyValueItems: [{ id: "1", key: "진료시간", value: "9-18" }],
          sentence: "",
        },
      },
    });
    const out = renderMarkdown(s);
    // specifics should not appear under '대답의 범위 및 내용'
    expect(out).not.toContain("### 특정 내용 지정");
    // should appear in the reference block
    expect(out).toContain("[답변 참고자료]");
    expect(out).toContain("- 진료시간: 9-18");
    expect(out).toContain("AA1000");
    // reference block should be the last block in the output
    expect(out.trimEnd().endsWith("AA1000")).toBe(true);
  });

  it("RAG enable emits only the bottom reference block (no standalone answerScope section)", () => {
    const s = baseStructuring({
      answerScope: {
        rag: { enabled: true, performanceNotes: "top_k=3 (ignored)" },
        specifics: { type: "keyValue", keyValueItems: [], sentence: "" },
      },
    });
    const out = renderMarkdown(s);
    // AnswerScope has no standalone output block — RAG flag is consumed
    // by the reference-block renderer only.
    expect(out).not.toContain("## 대답의 범위 및 내용");
    expect(out).not.toContain("### RAG");
    expect(out).not.toContain("top_k=3");
    expect(out).not.toContain("성능 개선");
    expect(out).toContain("[답변 참고자료]");
    expect(out).toContain("AA1000");
  });
});

describe("renderer: block order mirrors REGION_ORDER", () => {
  it("markdown outputs role → persona → company → system → conversation → branching → custom → reference", () => {
    const s = baseStructuring({
      role: { content: "역할" },
      persona: { language: "한국어", tone: "정중" },
      companyInfo: { description: "회사 소개", greeting: "" },
      answerScope: {
        rag: { enabled: true, performanceNotes: "" },
        specifics: { type: "keyValue", keyValueItems: [], sentence: "" },
      },
      branching: {
        topLevelRules: [],
        steps: [{ id: "s1", title: "부서 확인", body: "→ 문의 식별" }],
      },
      system: { rules: "STT 규칙 본문" },
      conversation: {
        rules: {
          rejectOutOfScope: true,
          noReAskCollected: false,
          oneQuestionAtATime: false,
          noInference: false,
          restrictedInfoOnly: false,
        },
        customNotes: "",
      },
      custom: { items: [{ id: "c1", tag: "주의 사항", content: "반드시 존댓말" }] },
    });
    const out = renderMarkdown(s);
    const idx = (needle: string) => out.indexOf(needle);
    const role = idx("## Role");
    const persona = idx("## Persona");
    const company = idx("## 업무 및 회사 정보");
    const system = idx("## System");
    const conversation = idx("## 대화 유지 규칙");
    const branching = idx("## 대화 흐름");
    const custom = idx("## 주의 사항");
    const reference = idx("[답변 참고자료]");
    expect(role).toBeGreaterThanOrEqual(0);
    expect(role).toBeLessThan(persona);
    expect(persona).toBeLessThan(company);
    expect(company).toBeLessThan(system);
    expect(system).toBeLessThan(conversation);
    expect(conversation).toBeLessThan(branching);
    expect(branching).toBeLessThan(custom);
    expect(custom).toBeLessThan(reference);
  });
});

describe("renderer: conversation.customNotes is never shown", () => {
  it("markdown skips customNotes even when populated", () => {
    const s = baseStructuring({
      conversation: {
        rules: {
          rejectOutOfScope: true,
          noReAskCollected: false,
          oneQuestionAtATime: false,
          noInference: false,
          restrictedInfoOnly: false,
        },
        customNotes: "이 텍스트는 출력되면 안 됨",
      },
    });
    const out = renderMarkdown(s);
    expect(out).not.toContain("추가 사항");
    expect(out).not.toContain("이 텍스트는 출력되면 안 됨");
  });

  it("xml skips additional_notes tag even when populated", () => {
    const s = baseStructuring({
      conversation: {
        rules: {
          rejectOutOfScope: true,
          noReAskCollected: false,
          oneQuestionAtATime: false,
          noInference: false,
          restrictedInfoOnly: false,
        },
        customNotes: "stray notes",
      },
    });
    const out = renderXml(s);
    expect(out).not.toContain("<additional_notes>");
    expect(out).not.toContain("stray notes");
  });
});

describe("renderer: custom sections", () => {
  it("markdown renders each custom item as its own ## section", () => {
    const s = baseStructuring({
      custom: {
        items: [
          { id: "a", tag: "주의 사항", content: "반드시 존댓말" },
          { id: "b", tag: "금칙어", content: "욕설 금지" },
        ],
      },
    });
    const out = renderMarkdown(s);
    expect(out).toContain("## 주의 사항\n반드시 존댓말");
    expect(out).toContain("## 금칙어\n욕설 금지");
  });

  it("xml wraps each item in <section name=\"...\">", () => {
    const s = baseStructuring({
      custom: {
        items: [{ id: "a", tag: "주의 사항", content: "반드시 존댓말" }],
      },
    });
    const out = renderXml(s);
    expect(out).toContain('<section name="주의 사항">');
    expect(out).toContain("반드시 존댓말");
    expect(out).toContain("</section>");
  });

  it("xml escapes double-quotes in the tag attribute", () => {
    const s = baseStructuring({
      custom: {
        items: [{ id: "a", tag: `"quoted"`, content: "x" }],
      },
    });
    const out = renderXml(s);
    expect(out).toContain('<section name="&quot;quoted&quot;">');
  });

  it("gemini wraps each item in a ---#TITLE--- section", () => {
    const s = baseStructuring({
      custom: {
        items: [{ id: "a", tag: "주의 사항", content: "반드시 존댓말" }],
      },
    });
    const out = renderGemini(s);
    expect(out).toContain("# 주의 사항");
    expect(out).toContain("반드시 존댓말");
  });

  it("all renderers skip items missing tag or content", () => {
    const s = baseStructuring({
      custom: {
        items: [
          { id: "a", tag: "", content: "태그 없음 → skip" },
          { id: "b", tag: "내용 없음", content: "" },
          { id: "c", tag: "둘 다 있음", content: "이건 남아야 함" },
        ],
      },
    });
    for (const out of [renderMarkdown(s), renderXml(s), renderGemini(s)]) {
      expect(out).not.toContain("태그 없음 → skip");
      expect(out).not.toContain("내용 없음");
      expect(out).toContain("이건 남아야 함");
    }
  });

  it("all renderers output nothing extra when items array is empty", () => {
    const s = baseStructuring();
    // No custom items → output ends with the prior region's content
    const markdown = renderMarkdown(s);
    const xml = renderXml(s);
    const gemini = renderGemini(s);
    // Can't easily verify absence of custom output since it's unstyled —
    // just confirm the renderers still produce something (no crash) and
    // don't include the placeholder "섹션 제목(태그)" prompt text.
    expect(markdown).not.toContain("섹션 제목");
    expect(xml).not.toContain("섹션 제목");
    expect(gemini).not.toContain("섹션 제목");
  });

  it("custom sections appear before the reference block at the end", () => {
    const s = baseStructuring({
      answerScope: {
        rag: { enabled: true, performanceNotes: "" },
        specifics: { type: "keyValue", keyValueItems: [], sentence: "" },
      },
      custom: {
        items: [{ id: "a", tag: "주의 사항", content: "반드시 존댓말" }],
      },
    });
    const out = renderMarkdown(s);
    const customIdx = out.indexOf("주의 사항");
    const refIdx = out.indexOf("[답변 참고자료]");
    expect(customIdx).toBeGreaterThan(-1);
    expect(refIdx).toBeGreaterThan(customIdx);
  });
});

describe("renderer: reference block is absent when not needed", () => {
  it("markdown renders nothing related to reference when RAG off and specifics empty", () => {
    const out = renderMarkdown(baseStructuring());
    expect(out).not.toContain("[답변 참고자료]");
    expect(out).not.toContain("AA1000");
  });

  it("xml renders nothing related to reference when RAG off and specifics empty", () => {
    const out = renderXml(baseStructuring());
    expect(out).not.toContain("[답변 참고자료]");
    expect(out).not.toContain("AA1000");
  });

  it("gemini renders nothing related to reference when RAG off and specifics empty", () => {
    const out = renderGemini(baseStructuring());
    expect(out).not.toContain("[답변 참고자료]");
    expect(out).not.toContain("AA1000");
  });
});
