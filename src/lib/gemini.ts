import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyzeImageWithOpenAI } from "./openai-vision";
import { logger, withLog } from "./logger";

/**
 * Lazy-init Gemini client. We don't construct it at module load so a
 * missing key surfaces as a request-time error instead of crashing the
 * server boot — same pattern as src/lib/openai.ts.
 */
let cached: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (or your deployment env)."
    );
  }
  cached = new GoogleGenerativeAI(apiKey);
  return cached;
}

/** Default vision model — Flash strikes a good speed/cost balance for
 *  flowchart-style image OCR. 2.0-flash is being retired for new
 *  projects; 2.5-flash is the current recommended successor. */
const DEFAULT_VISION_MODEL = "gemini-2.5-flash";

export interface AnalyzeImageInput {
  /** Base64-encoded image bytes (no `data:` prefix). */
  base64: string;
  /** Mime type, e.g. "image/png", "image/jpeg". */
  mimeType: string;
  /** System/instruction prompt — applied as the first text part. */
  prompt: string;
  /** Optional model override. */
  model?: string;
  /** Request correlation ID (logger.makeRequestId). Threaded through
   *  to the OpenAI fallback so all log lines for one image stay tied. */
  rid?: string;
}

/**
 * Send an image + prompt to Gemini and return the model's text reply.
 * On any Gemini failure (missing key, 429 quota, 404 model retired,
 * 5xx, transport error, etc.) we automatically fall back to OpenAI
 * Vision so the upload flow stays resilient. If both providers fail,
 * the OpenAI error is thrown — its `cause` carries the original
 * Gemini failure for diagnostics.
 */
export async function analyzeImageWithGemini(
  input: AnalyzeImageInput
): Promise<string> {
  const model = input.model ?? DEFAULT_VISION_MODEL;
  const bytes = Math.ceil((input.base64.length * 3) / 4);
  const meta = { rid: input.rid, model, mimeType: input.mimeType, bytes };

  try {
    const response = await withLog(
      "[gemini] vision",
      meta,
      async () => {
        const client = getClient();
        const m = client.getGenerativeModel({
          model,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        });

        const result = await m.generateContent([
          { text: input.prompt },
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.base64,
            },
          },
        ]);

        return result.response;
      },
      (resp) => {
        // Extract every signal that helps tell apart the truncation
        // modes (STOP / MAX_TOKENS / SAFETY / RECITATION) and the
        // actual prompt-block case (promptFeedback.blockReason).
        const cand = resp.candidates?.[0];
        const text = (() => {
          try {
            return resp.text();
          } catch {
            return "";
          }
        })();
        return {
          textLength: text.length,
          finishReason: cand?.finishReason,
          finishMessage: cand?.finishMessage,
          blockReason: resp.promptFeedback?.blockReason,
          safetyRatings: cand?.safetyRatings,
          usage: resp.usageMetadata,
          preview: text.slice(0, 80),
        };
      }
    );
    return response.text();
  } catch (geminiErr) {
    logger.warn(
      "[gemini] vision falling back to openai",
      { rid: input.rid, error: (geminiErr as Error).message }
    );
    try {
      // Don't pass through `input.model` — that's a Gemini model id and
      // would be invalid for OpenAI. Let the OpenAI wrapper use its own
      // default.
      return await analyzeImageWithOpenAI({
        base64: input.base64,
        mimeType: input.mimeType,
        prompt: input.prompt,
        rid: input.rid,
      });
    } catch (openaiErr) {
      throw new Error(
        `Both Gemini and OpenAI image analysis failed. ` +
          `Gemini: ${(geminiErr as Error).message}. ` +
          `OpenAI: ${(openaiErr as Error).message}`,
        { cause: openaiErr }
      );
    }
  }
}
