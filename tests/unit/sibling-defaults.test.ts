import { describe, it, expect } from "vitest";
import {
  SIBLING_DEFAULTS,
  getSiblingDefault,
  assertSiblingDefaultsComplete,
} from "@/lib/sibling-defaults";
import { SIBLING_PRMT_CDS } from "@/lib/prompt-codes";

describe("SIBLING_DEFAULTS", () => {
  it("covers every sibling prmt_cd", () => {
    expect(() => assertSiblingDefaultsComplete()).not.toThrow();
    for (const cd of SIBLING_PRMT_CDS) {
      expect(SIBLING_DEFAULTS[cd]).toBeDefined();
      expect(typeof SIBLING_DEFAULTS[cd].prompt).toBe("string");
      expect(SIBLING_DEFAULTS[cd].prompt.length).toBeGreaterThan(0);
    }
  });

  it("keeps an explicit TODO marker in each placeholder so it cannot silently ship", () => {
    for (const cd of SIBLING_PRMT_CDS) {
      expect(SIBLING_DEFAULTS[cd].prompt).toMatch(/TODO/);
    }
  });

  it("stores json_schema as null or a parseable JSON string", () => {
    for (const cd of SIBLING_PRMT_CDS) {
      const value = SIBLING_DEFAULTS[cd].json_schema;
      if (value !== null) {
        expect(() => JSON.parse(value)).not.toThrow();
      }
    }
  });

  it("getSiblingDefault returns the same object as SIBLING_DEFAULTS lookup", () => {
    for (const cd of SIBLING_PRMT_CDS) {
      expect(getSiblingDefault(cd)).toBe(SIBLING_DEFAULTS[cd]);
    }
  });
});
