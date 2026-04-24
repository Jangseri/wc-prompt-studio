import { z } from "zod";
import { channelSchema } from "./common";

/** New path: regions mode for the unified workspace.
 *  parsedText may be empty when the user excluded it from the Analysis
 *  step; in that case at least one image description must remain. */
export const regionsGenerateRequestSchema = z
  .object({
    mode: z.literal("regions"),
    parsedText: z.string().max(1_000_000),
    images: z.array(z.string()).max(50).optional(),
    channel: channelSchema,
    industry: z.string().min(1).max(100),
  })
  .refine(
    (v) => v.parsedText.length > 0 || (v.images?.length ?? 0) > 0,
    { message: "parsedText 또는 images 중 하나 이상은 비어있지 않아야 합니다" }
  );
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
