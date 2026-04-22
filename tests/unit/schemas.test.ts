import { describe, it, expect } from "vitest";
import {
  identifierSchema,
  jsonSchemaField,
  codeSchema,
  channelSchema,
} from "@/lib/schemas/common";
import {
  generateRequestSchema,
  regionsGenerateRequestSchema,
  isRegionsRequest,
} from "@/lib/schemas/generate";
import {
  promptsPostSchema,
  channelPromptsPostSchema,
  legacyPromptsPostSchema,
  isChannelPromptsPost,
} from "@/lib/schemas/prompts";
import { parseCompaniesQuery } from "@/lib/schemas/companies";

describe("identifierSchema", () => {
  it.each([
    ["__TEST__hospital", true],
    ["hospital-01", true],
    ["A1_B2", true],
    ["1", true],
    ["", false],
    ["x".repeat(65), false],
    ["bad value", false],
    ["x'; DROP TABLE cstm_prmt_info; --", false],
    ["한글은허용안됨", false],
  ])("identifierSchema(%p) -> ok=%p", (input, ok) => {
    const result = identifierSchema.safeParse(input);
    expect(result.success).toBe(ok);
  });
});

describe("codeSchema", () => {
  it.each([
    ["SA1000", true],
    ["PD2000", true],
    ["PA4000", true],
    ["sa1000", false],
    ["SA10000", false],
    ["SA100", false],
    ["SA-1000", false],
  ])("codeSchema(%p) -> ok=%p", (input, ok) => {
    expect(codeSchema.safeParse(input).success).toBe(ok);
  });
});

describe("channelSchema", () => {
  it("accepts callbot and chatbot, rejects others", () => {
    expect(channelSchema.safeParse("callbot").success).toBe(true);
    expect(channelSchema.safeParse("chatbot").success).toBe(true);
    expect(channelSchema.safeParse("voicebot").success).toBe(false);
  });
});

describe("jsonSchemaField", () => {
  it("accepts null, undefined, empty string (coerced to null), and valid JSON", () => {
    expect(jsonSchemaField.parse(null)).toBeNull();
    expect(jsonSchemaField.parse(undefined)).toBeNull();
    expect(jsonSchemaField.parse("")).toBeNull();
    expect(jsonSchemaField.parse('{"a":1}')).toBe('{"a":1}');
  });

  it("rejects malformed JSON strings", () => {
    expect(jsonSchemaField.safeParse("{not json").success).toBe(false);
    expect(jsonSchemaField.safeParse("just text").success).toBe(false);
  });
});

describe("generateRequestSchema", () => {
  it("accepts a regions-mode request", () => {
    const result = generateRequestSchema.safeParse({
      mode: "regions",
      parsedText: "some text",
      channel: "callbot",
      industry: "병원",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a legacy request without mode", () => {
    const result = generateRequestSchema.safeParse({
      parsedText: "legacy body",
      industry: "일반",
    });
    expect(result.success).toBe(true);
  });

  it("rejects regions mode with invalid channel", () => {
    const result = generateRequestSchema.safeParse({
      mode: "regions",
      parsedText: "x",
      channel: "telegram",
      industry: "x",
    });
    expect(result.success).toBe(false);
  });

  it("isRegionsRequest narrows only when mode === 'regions'", () => {
    const r = regionsGenerateRequestSchema.parse({
      mode: "regions",
      parsedText: "t",
      channel: "chatbot",
      industry: "finance",
    });
    expect(isRegionsRequest(r)).toBe(true);
  });
});

describe("promptsPostSchema", () => {
  it("accepts channel-enriched payload (new path)", () => {
    const res = promptsPostSchema.safeParse({
      company_seq: "__TEST__hospital",
      ai_staff_seq: "1",
      channel: "callbot",
      prompt: "hello",
    });
    expect(res.success).toBe(true);
  });

  it("accepts legacy single-record payload", () => {
    const res = promptsPostSchema.safeParse({
      company_seq: "A001",
      ai_staff_seq: "1",
      svc_cd: "SA1000",
      prmt_cd: "PD2000",
      prompt: "hello",
    });
    expect(res.success).toBe(true);
  });

  it("rejects missing company_seq", () => {
    const res = promptsPostSchema.safeParse({
      ai_staff_seq: "1",
      channel: "callbot",
      prompt: "x",
    });
    expect(res.success).toBe(false);
  });

  it("rejects SQL-injection-shaped company_seq", () => {
    const res = channelPromptsPostSchema.safeParse({
      company_seq: "a'); DROP TABLE cstm_prmt_info; --",
      ai_staff_seq: "1",
      channel: "callbot",
      prompt: "x",
    });
    expect(res.success).toBe(false);
  });

  it("isChannelPromptsPost narrows correctly", () => {
    const channel = channelPromptsPostSchema.parse({
      company_seq: "A",
      ai_staff_seq: "1",
      channel: "chatbot",
      prompt: "x",
    });
    const legacy = legacyPromptsPostSchema.parse({
      company_seq: "A",
      ai_staff_seq: "1",
      svc_cd: "SA1000",
      prmt_cd: "PD2000",
      prompt: "x",
    });
    expect(isChannelPromptsPost(channel)).toBe(true);
    expect(isChannelPromptsPost(legacy)).toBe(false);
  });
});

describe("parseCompaniesQuery", () => {
  it("accepts empty query params", () => {
    const result = parseCompaniesQuery(new URLSearchParams());
    expect(result).toEqual({});
  });

  it("parses valid filters", () => {
    const result = parseCompaniesQuery(
      new URLSearchParams("company_seq=A001&channel=callbot&status=Y")
    );
    expect(result).toEqual({
      company_seq: "A001",
      channel: "callbot",
      status: "Y",
    });
  });

  it("rejects bad identifiers", () => {
    expect(() =>
      parseCompaniesQuery(new URLSearchParams("company_seq=bad value"))
    ).toThrow();
  });
});
