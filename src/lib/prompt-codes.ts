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
  svc_cd: "SA1000" | "SA1200" | "SA2000";
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

/**
 * Industry-specific svc_cd overrides. When an apply is invoked with an
 * industry listed here, the override replaces CHANNEL_CODES[channel].svc_cd.
 * Only svc_cd is changed — prmt_cd and json_schema stay from the base
 * channel code.
 *
 * 병원 callbot uses SA1200 (회사코드 트리에서 "콜봇/병원" 자리). 병원 chatbot은
 * 별도 코드가 없으므로 기본 SA2000 유지. 신규 업종이 생기면 이 맵만 확장.
 */
export const INDUSTRY_SVC_CD_OVERRIDES: Record<
  string,
  Partial<Record<Channel, ChannelCode["svc_cd"]>>
> = {
  병원: {
    callbot: "SA1200",
  },
};

export function resolveChannelCode(
  channel: Channel,
  industry: string
): ChannelCode {
  const override = INDUSTRY_SVC_CD_OVERRIDES[industry]?.[channel];
  if (!override) return CHANNEL_CODES[channel];
  return { ...CHANNEL_CODES[channel], svc_cd: override };
}

/**
 * svc_cd values that belong to each channel family. New prompts are
 * always created with the canonical SA1000/SA2000 (see CHANNEL_CODES),
 * but historical records may use sibling codes like SA1200 that live
 * under the same "서비스_워크센터_CALL" parent in the code tree. The
 * management UI surfaces those as "콜봇" too.
 */
export const CALLBOT_SVC_CDS: readonly string[] = ["SA1000", "SA1200"] as const;
export const CHATBOT_SVC_CDS: readonly string[] = ["SA2000"] as const;

export function isCallbotSvcCd(svc_cd: string): boolean {
  return (CALLBOT_SVC_CDS as readonly string[]).includes(svc_cd);
}

export function isChatbotSvcCd(svc_cd: string): boolean {
  return (CHATBOT_SVC_CDS as readonly string[]).includes(svc_cd);
}

/**
 * Human-readable channel label keyed by svc_cd. Shared between the
 * companies sidebar and the management panel so both surfaces use the
 * exact same wording ("콜봇" / "챗봇") and the same chip color map.
 */
export const CHANNEL_LABEL: Record<string, string> = {
  SA1000: "콜봇",
  SA1200: "콜봇",
  SA2000: "챗봇",
};

/** Display order when grouping by svc_cd. Matches sidebar visual order:
 *  callbot family first (SA1000 → SA1200), then chatbot (SA2000). */
export const SVC_CD_ORDER: readonly string[] = [
  "SA1000",
  "SA1200",
  "SA2000",
] as const;

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
