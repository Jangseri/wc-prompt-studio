/**
 * Channel -> svc_cd / prmt_cd / default json_schema mapping.
 * See docs/unified-workspace-plan.md §2.1.
 *
 * chatbot.json_schema is the `double_response_list` schema confirmed by the
 * user during step-2 blocker resolution. Stored as a JSON string because
 * cstm_prmt_info.json_schema is a text column.
 */

export type Channel = "callbot" | "chatbot";

export interface ChannelCode {
  svc_cd: "SA1000" | "SA2000";
  prmt_cd: "PD2000" | "PD0000";
  json_schema: string | null;
}

const CHATBOT_JSON_SCHEMA = JSON.stringify({
  name: "double_response_list",
  strict: true,
  schema: {
    type: "object",
    properties: {
      messages: {
        type: "string",
        description: "고객에게 전달할 자연스러운 존댓말 응답 문장입니다.",
      },
      reactionType: {
        type: "string",
        enum: ["dialog", "reaction_saveReception"],
        description: "고객 응답에 따른 대화 흐름 분기 타입입니다.",
      },
    },
    required: ["messages", "reactionType"],
    additionalProperties: false,
  },
});

export const CHANNEL_CODES: Record<Channel, ChannelCode> = {
  callbot: { svc_cd: "SA1000", prmt_cd: "PD2000", json_schema: null },
  chatbot: { svc_cd: "SA2000", prmt_cd: "PD0000", json_schema: CHATBOT_JSON_SCHEMA },
};

export const SIBLING_PRMT_CDS = ["PA4000", "PA1000", "PC1000"] as const;
export type SiblingPrmtCd = (typeof SIBLING_PRMT_CDS)[number];

export function isChannel(value: unknown): value is Channel {
  return value === "callbot" || value === "chatbot";
}

export function isSiblingPrmtCd(value: unknown): value is SiblingPrmtCd {
  return (
    typeof value === "string" &&
    (SIBLING_PRMT_CDS as readonly string[]).includes(value)
  );
}
