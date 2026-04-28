import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";
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
  /** logger.makeRequestId() 로 만든 correlation ID. OpenAI 폴백까지
   *  같이 넘겨서 한 이미지에 대한 로그가 같은 ID 로 묶이도록. */
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
          // Gemini 2.5 시리즈는 thinking 모델이라 기본값에선 thoughts
          // 토큰이 maxOutputTokens 예산을 같이 잠식한다. OCR/추출 같은
          // 단순 작업엔 thinking 이 도움 안 됨. 실측: 한 이미지에서
          // thoughtsTokenCount=3696 + candidatesTokenCount=396 으로
          // 4096 cap 도달, finishReason: MAX_TOKENS 로 응답 mid-token
          // 잘림. thinkingBudget: 0 으로 끄면 전체 예산이 visible
          // 출력으로 감.
          // 이 필드는 @google/generative-ai 0.24.1 의 GenerationConfig
          // 타입엔 아직 없어서 as unknown 캐스팅 — REST API 는 정상 수신.
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingBudget: 0 },
          } as unknown as GenerationConfig,
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
        // truncation 종류 (STOP / MAX_TOKENS / SAFETY / RECITATION) 와
        // 프롬프트 자체 차단(promptFeedback.blockReason) 까지 구분 가능
        // 하도록 가능한 모든 시그널을 메타로 노출.
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
