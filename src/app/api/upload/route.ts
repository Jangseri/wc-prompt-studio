import { NextRequest, NextResponse } from "next/server";
import { parseExcel } from "@/lib/excel-parser";
import { extractImagesFromXlsx } from "@/lib/image-extractor";
import { openai } from "@/lib/openai";
import { IMAGE_ANALYSIS_PROMPT } from "@/lib/system-prompt";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const type = formData.get("type") as string;

    if (!files.length) {
      return NextResponse.json({ error: "No files" }, { status: 400 });
    }

    let combinedText = "";
    const imageDescriptions: string[] = [];
    const warnings: string[] = [];
    let detectedType = type || "general";

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.name.endsWith(".xlsx")) {
        // Parse text from Excel
        const { textContent } = await parseExcel(buffer);
        combinedText += textContent + "\n";

        // Extract images from Excel
        const images = await extractImagesFromXlsx(buffer);

        // Analyze images with GPT-4 Vision
        for (const img of images) {
          try {
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
                        url: `data:${img.mimeType};base64,${img.base64}`,
                        detail: "high",
                      },
                    },
                  ],
                },
              ],
              max_tokens: 4096,
            });
            const desc = response.choices[0]?.message?.content;
            if (desc) imageDescriptions.push(desc);
          } catch (err) {
            logger.error("[upload] image analysis failed", err);
            warnings.push(`엑셀 내 이미지 "${img.fileName}" 분석 실패`);
          }
        }
      } else if (
        file.type.startsWith("image/") ||
        /\.(png|jpg|jpeg)$/i.test(file.name)
      ) {
        // Direct image upload
        const base64 = buffer.toString("base64");
        const mimeType = file.type || "image/png";

        try {
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
                    image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
                  },
                ],
              },
            ],
            max_tokens: 4096,
          });
          const desc = response.choices[0]?.message?.content;
          if (desc) imageDescriptions.push(desc);
        } catch (err) {
          logger.error("[upload] image analysis failed", err);
          warnings.push(`이미지 "${file.name}" 분석 실패`);
        }
      }
    }

    // Auto-detect type from text
    const hospitalKeywords = [
      "병원", "진료", "진료과", "산부인과", "소아", "내과", "외과",
      "신환", "초진", "재진", "접수", "예약", "진료시간",
    ];
    const hospitalScore = hospitalKeywords.filter((kw) =>
      combinedText.includes(kw)
    ).length;
    if (hospitalScore >= 2) detectedType = "hospital";

    return NextResponse.json({
      textContent: combinedText,
      imageDescriptions,
      detectedType,
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (err) {
    logger.error("[upload] failed", err);
    return NextResponse.json(
      { error: "Upload processing failed" },
      { status: 500 }
    );
  }
}
