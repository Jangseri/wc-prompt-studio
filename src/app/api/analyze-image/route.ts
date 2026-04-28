import { NextRequest, NextResponse } from "next/server";
import { analyzeImageWithGemini } from "@/lib/gemini";
import { IMAGE_ANALYSIS_PROMPT } from "@/lib/system-prompt";
import { logger, logRoute } from "@/lib/logger";

export async function POST(req: NextRequest) {
  return logRoute("[analyze-image] POST", {}, async (rid) => {
    try {
      const body = await req.json();
      const { image, mimeType } = body;

      const description = await analyzeImageWithGemini({
        base64: image,
        mimeType: mimeType || "image/png",
        prompt: IMAGE_ANALYSIS_PROMPT,
        rid,
      });

      return NextResponse.json({ description });
    } catch (err) {
      logger.error("[analyze-image] failed", { rid, err });
      return NextResponse.json(
        { error: "Image analysis failed" },
        { status: 500 }
      );
    }
  });
}
