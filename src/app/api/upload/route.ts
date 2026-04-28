import { NextRequest, NextResponse } from "next/server";
import { parseExcel } from "@/lib/excel-parser";
import { extractImagesFromXlsx } from "@/lib/image-extractor";
import { analyzeImageWithGemini } from "@/lib/gemini";
import { IMAGE_ANALYSIS_PROMPT } from "@/lib/system-prompt";
import { logger, logRoute } from "@/lib/logger";

export async function POST(req: NextRequest) {
  return logRoute("[upload] POST", {}, async (rid) => {
    try {
      const formData = await req.formData();
      const files = formData.getAll("files") as File[];
      const type = formData.get("type") as string;

      if (!files.length) {
        return NextResponse.json({ error: "No files" }, { status: 400 });
      }

      logger.info("[upload] files received", {
        rid,
        count: files.length,
        files: files.map((f) => ({ name: f.name, size: f.size })),
      });

      let combinedText = "";
      const imageDescriptions: string[] = [];
      const warnings: string[] = [];
      let detectedType = type || "general";

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());

        if (file.name.endsWith(".xlsx")) {
          // Parse text from Excel
          const { textContent } = await parseExcel(buffer, rid);
          combinedText += textContent + "\n";

          // Extract images from Excel and analyze each via Gemini Vision
          const images = await extractImagesFromXlsx(buffer, rid);
          for (const img of images) {
            try {
              const desc = await analyzeImageWithGemini({
                base64: img.base64,
                mimeType: img.mimeType,
                prompt: IMAGE_ANALYSIS_PROMPT,
                rid,
              });
              if (desc) imageDescriptions.push(desc);
            } catch (err) {
              logger.error("[upload] image analysis failed", {
                rid,
                fileName: img.fileName,
                err,
              });
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
            const desc = await analyzeImageWithGemini({
              base64,
              mimeType,
              prompt: IMAGE_ANALYSIS_PROMPT,
              rid,
            });
            if (desc) imageDescriptions.push(desc);
          } catch (err) {
            logger.error("[upload] image analysis failed", {
              rid,
              fileName: file.name,
              err,
            });
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

      logger.info("[upload] result", {
        rid,
        textLength: combinedText.length,
        imagesAnalyzed: imageDescriptions.length,
        warnings: warnings.length,
        detectedType,
      });

      return NextResponse.json({
        textContent: combinedText,
        imageDescriptions,
        detectedType,
        ...(warnings.length > 0 && { warnings }),
      });
    } catch (err) {
      logger.error("[upload] failed", { rid, err });
      return NextResponse.json(
        { error: "Upload processing failed" },
        { status: 500 }
      );
    }
  });
}
