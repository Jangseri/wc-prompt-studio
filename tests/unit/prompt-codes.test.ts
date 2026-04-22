import { describe, it, expect } from "vitest";
import {
  CHANNEL_CODES,
  SIBLING_PRMT_CDS,
  isChannel,
  isSiblingPrmtCd,
} from "@/lib/prompt-codes";

describe("CHANNEL_CODES", () => {
  it("maps callbot to SA1000 / PD2000 with null json_schema", () => {
    expect(CHANNEL_CODES.callbot).toEqual({
      svc_cd: "SA1000",
      prmt_cd: "PD2000",
      json_schema: null,
    });
  });

  it("maps chatbot to SA2000 / PD0000 with a parseable json_schema string", () => {
    expect(CHANNEL_CODES.chatbot.svc_cd).toBe("SA2000");
    expect(CHANNEL_CODES.chatbot.prmt_cd).toBe("PD0000");
    expect(CHANNEL_CODES.chatbot.json_schema).not.toBeNull();

    const parsed = JSON.parse(CHANNEL_CODES.chatbot.json_schema as string);
    expect(parsed.name).toBe("double_response_list");
    expect(parsed.strict).toBe(true);
    expect(parsed.schema.required).toEqual(["messages", "reactionType"]);
    expect(parsed.schema.properties.reactionType.enum).toEqual([
      "dialog",
      "reaction_saveReception",
    ]);
    expect(parsed.schema.additionalProperties).toBe(false);
  });
});

describe("SIBLING_PRMT_CDS", () => {
  it("has the three expected siblings in plan order (PA4000, PA1000, PC1000)", () => {
    expect([...SIBLING_PRMT_CDS]).toEqual(["PA4000", "PA1000", "PC1000"]);
  });
});

describe("isChannel", () => {
  it.each([
    ["callbot", true],
    ["chatbot", true],
    ["voicebot", false],
    ["", false],
    [null, false],
    [undefined, false],
    [123, false],
    [{}, false],
  ])("isChannel(%p) === %p", (input, expected) => {
    expect(isChannel(input)).toBe(expected);
  });
});

describe("isSiblingPrmtCd", () => {
  it.each([
    ["PA4000", true],
    ["PA1000", true],
    ["PC1000", true],
    ["PD2000", false],
    ["pa4000", false],
    [null, false],
  ])("isSiblingPrmtCd(%p) === %p", (input, expected) => {
    expect(isSiblingPrmtCd(input)).toBe(expected);
  });
});
