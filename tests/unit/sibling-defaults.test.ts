import { describe, it, expect } from "vitest";
import {
  SIBLING_DEFAULTS,
  getSiblingDefault,
  assertSiblingDefaultsComplete,
} from "@/lib/sibling-defaults";
import { SIBLING_PRMT_CDS } from "@/lib/prompt-codes";

describe("SIBLING_DEFAULTS coverage", () => {
  it("has an entry for every sibling prmt_cd", () => {
    expect(() => assertSiblingDefaultsComplete()).not.toThrow();
    for (const cd of SIBLING_PRMT_CDS) {
      expect(SIBLING_DEFAULTS[cd]).toBeDefined();
      expect(typeof SIBLING_DEFAULTS[cd].prompt).toBe("string");
      expect(SIBLING_DEFAULTS[cd].prompt.length).toBeGreaterThan(100);
      expect(SIBLING_DEFAULTS[cd].prompt).not.toMatch(/TODO/);
    }
  });

  it("getSiblingDefault returns the same object as SIBLING_DEFAULTS lookup", () => {
    for (const cd of SIBLING_PRMT_CDS) {
      expect(getSiblingDefault(cd)).toBe(SIBLING_DEFAULTS[cd]);
    }
  });
});

describe("PA4000 (dialog-type classifier)", () => {
  it("prompt covers all five reaction types", () => {
    const p = SIBLING_DEFAULTS.PA4000.prompt;
    expect(p).toMatch(/## dialog/);
    expect(p).toMatch(/## reaction_transferCall/);
    expect(p).toMatch(/## reaction_getDtmf/);
    expect(p).toMatch(/## reaction_saveReception/);
    expect(p).toMatch(/## reaction_disconnect/);
  });

  it("json_schema is null (plain-text output, no schema)", () => {
    expect(SIBLING_DEFAULTS.PA4000.json_schema).toBeNull();
  });
});

describe("PA1000 (customer-info extraction / FORM_LLM_01)", () => {
  it("json_schema parses to the FORM_LLM_01 strict shape", () => {
    const raw = SIBLING_DEFAULTS.PA1000.json_schema;
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.name).toBe("FORM_LLM_01");
    expect(parsed.strict).toBe(true);
    expect(parsed.schema.required).toEqual(["접수자", "연락처", "문의 내용"]);
    expect(parsed.schema.additionalProperties).toBe(false);
    expect(parsed.schema.properties.접수자.type).toBe("string");
    expect(parsed.schema.properties.연락처.type).toBe("string");
    expect(parsed.schema.properties["문의 내용"].type).toBe("string");
  });
});

describe("PC1000 (dept classifier)", () => {
  it("prompt contains the AA2004 dept enum marker and AA3000 dialog block", () => {
    const p = SIBLING_DEFAULTS.PC1000.prompt;
    expect(p).toMatch(/AA2004/);
    expect(p).toMatch(/AA3000/);
  });

  it("json_schema is a template (intentionally non-parseable due to AA markers)", () => {
    const raw = SIBLING_DEFAULTS.PC1000.json_schema;
    expect(raw).not.toBeNull();
    expect(raw).toMatch(/"name": "dept_classification_response"/);
    expect(raw).toMatch(/"enum": AA2004/);
    // Standard JSON.parse should reject the raw template until downstream
    // substitution replaces AA2004 with a concrete array.
    expect(() => JSON.parse(raw as string)).toThrow();
  });
});
