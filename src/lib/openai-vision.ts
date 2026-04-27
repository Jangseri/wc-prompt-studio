import { openai } from "./openai";

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
}

/**
 * Send an image + prompt to OpenAI Vision and return the model's text
 * reply. Mirrors the shape of `analyzeImageWithGemini` so callers can
 * swap between the two without changing call sites.
 */
export async function analyzeImageWithOpenAI(
  input: AnalyzeImageInput
): Promise<string> {
  const result = await openai.chat.completions.create({
    model: input.model ?? DEFAULT_VISION_MODEL,
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

  return result.choices[0]?.message?.content ?? "";
}
