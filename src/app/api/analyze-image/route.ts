import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { IMAGE_ANALYSIS_PROMPT } from "@/lib/system-prompt";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, mimeType } = body;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: IMAGE_ANALYSIS_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType || "image/png"};base64,${image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    const description = response.choices[0]?.message?.content ?? "";

    return NextResponse.json({ description });
  } catch (err) {
    logger.error("[analyze-image] failed", err);
    return NextResponse.json(
      { error: "Image analysis failed" },
      { status: 500 }
    );
  }
}
