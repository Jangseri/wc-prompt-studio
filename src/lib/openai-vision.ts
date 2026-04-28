import { openai } from "./openai";
import { withLog } from "./logger";

/** Default vision model — gpt-5 supports image input. Used as the
 *  fallback when Gemini is unavailable. */
const DEFAULT_VISION_MODEL = "gpt-5";

export interface AnalyzeImageInput {
  /** Base64-encoded image bytes (no `data:` prefix). */
  base64: string;
  /** Mime type, e.g. "image/png", "image/jpeg". */
  mimeType: string;
  /** System/instruction prompt — applied as the first text part. */
  prompt: string;
  /** Optional model override. */
  model?: string;
  /** Request correlation ID — same one Gemini logged with. */
  rid?: string;
}

/**
 * Send an image + prompt to OpenAI Vision and return the model's text
 * reply. Mirrors the shape of `analyzeImageWithGemini` so callers can
 * swap between the two without changing call sites.
 *
 * Logs `finishReason` and `usage` (including reasoning_tokens for
 * gpt-5-class reasoning models) so truncation / runaway-reasoning is
 * detectable from logs alone.
 */
export async function analyzeImageWithOpenAI(
  input: AnalyzeImageInput
): Promise<string> {
  const model = input.model ?? DEFAULT_VISION_MODEL;
  const bytes = Math.ceil((input.base64.length * 3) / 4);

  const result = await withLog(
    "[openai] vision",
    { rid: input.rid, model, mimeType: input.mimeType, bytes },
    async () => {
      return await openai.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: input.prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.mimeType};base64,${input.base64}`,
                },
              },
            ],
          },
        ],
      });
    },
    (res) => {
      const text = res.choices[0]?.message?.content ?? "";
      return {
        textLength: text.length,
        finishReason: res.choices[0]?.finish_reason,
        usage: res.usage,
        preview: text.slice(0, 80),
      };
    }
  );

  return result.choices[0]?.message?.content ?? "";
}
