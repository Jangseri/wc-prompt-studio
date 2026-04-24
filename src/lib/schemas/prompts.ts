import { z } from "zod";
import {
  channelSchema,
  codeSchema,
  identifierSchema,
  jsonSchemaField,
  statusSchema,
} from "./common";

const promptField = z.string().min(1).max(200_000);

/** Channel-driven path: triggers the 4-record transaction in /api/prompts POST. */
export const channelPromptsPostSchema = z.object({
  company_seq: identifierSchema,
  ai_staff_seq: identifierSchema,
  channel: channelSchema,
  /** Industry from the Source step. Combined with channel to pick the
   *  svc_cd via resolveChannelCode() (e.g. 병원 + callbot → SA1200). */
  industry: z.string().min(1).max(100),
  prompt: promptField,
  /** Optional override for the main record's json_schema. Leaving it undefined
   *  uses the resolved ChannelCode.json_schema. */
  json_schema: jsonSchemaField,
  status: statusSchema.optional(),
});
export type ChannelPromptsPost = z.infer<typeof channelPromptsPostSchema>;

/** Legacy single-record path. Kept for backward compatibility with the
 *  existing editor tab. */
export const legacyPromptsPostSchema = z.object({
  company_seq: identifierSchema,
  ai_staff_seq: identifierSchema,
  svc_cd: codeSchema,
  prmt_cd: codeSchema,
  prompt: promptField,
  json_schema: jsonSchemaField,
  status: statusSchema.optional(),
  channel: z.undefined().optional(),
});
export type LegacyPromptsPost = z.infer<typeof legacyPromptsPostSchema>;

export const promptsPostSchema = z.union([
  channelPromptsPostSchema,
  legacyPromptsPostSchema,
]);
export type PromptsPost = z.infer<typeof promptsPostSchema>;

export function isChannelPromptsPost(v: PromptsPost): v is ChannelPromptsPost {
  return "channel" in v && v.channel != null;
}
