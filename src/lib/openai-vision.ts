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
  /** Gemini 가 로깅한 것과 같은 correlation ID. */
  rid?: string;
}

/**
 * Send an image + prompt to OpenAI Vision and return the model's text
 * reply. Mirrors the shape of `analyzeImageWithGemini` so callers can
 * swap between the two without changing call sites.
 *
 * finishReason 과 usage(gpt-5 reasoning_tokens 포함)를 로그에 남겨,
 * truncation 이나 runaway reasoning 을 로그만 보고도 진단 가능.
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
