import { z } from "zod";
import { channelSchema } from "./common";

/** New path: regions mode for the unified workspace. */
export const regionsGenerateRequestSchema = z.object({
  mode: z.literal("regions"),
  parsedText: z.string().min(1).max(1_000_000),
  images: z.array(z.string()).max(50).optional(),
  channel: channelSchema,
  industry: z.string().min(1).max(100),
});
export type RegionsGenerateRequest = z.infer<typeof regionsGenerateRequestSchema>;

/** Legacy path: the original 7-section generate call. Kept loose since the
 *  existing frontend has been shipping; we only sanity-check field types. */
export const legacyGenerateRequestSchema = z.object({
  mode: z.undefined().optional(),
  parsedText: z.string().min(1).max(1_000_000),
  images: z.array(z.string()).max(50).optional(),
  industry: z.string().max(100).optional(),
  channelType: z.string().max(50).optional(),
});
export type LegacyGenerateRequest = z.infer<typeof legacyGenerateRequestSchema>;

/** Discriminated union used at the route entry. */
export const generateRequestSchema = z.union([
  regionsGenerateRequestSchema,
  legacyGenerateRequestSchema,
]);
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export function isRegionsRequest(req: GenerateRequest): req is RegionsGenerateRequest {
  return "mode" in req && req.mode === "regions";
}
