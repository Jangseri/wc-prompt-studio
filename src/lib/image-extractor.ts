import JSZip from "jszip";

export interface ExtractedImageData {
  base64: string;
  mimeType: string;
  fileName: string;
}

export async function extractImagesFromXlsx(
  buffer: Buffer
): Promise<ExtractedImageData[]> {
  const zip = await JSZip.loadAsync(buffer);
  const images: ExtractedImageData[] = [];

  const mediaFolder = zip.folder("xl/media");
  if (!mediaFolder) return images;

  const entries: { name: string; file: JSZip.JSZipObject }[] = [];
  mediaFolder.forEach((relativePath, file) => {
    entries.push({ name: relativePath, file });
  });

  const MIN_SIZE = 10 * 1024; // 10KB — 로고/아이콘 등 작은 이미지 제외

  for (const { name, file } of entries) {
    const lower = name.toLowerCase();
    let mimeType: string | null = null;

    if (lower.endsWith(".png")) mimeType = "image/png";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
      mimeType = "image/jpeg";
    else if (lower.endsWith(".gif")) mimeType = "image/gif";

    if (!mimeType) continue;

    const data = await file.async("base64");

    // base64 크기로 원본 바이트 추정 (base64 ≈ 원본 × 4/3)
    const estimatedBytes = Math.ceil((data.length * 3) / 4);
    if (estimatedBytes < MIN_SIZE) {
      console.log(`이미지 제외 (${estimatedBytes} bytes < ${MIN_SIZE}): ${name}`);
      continue;
    }

    images.push({ base64: data, mimeType, fileName: name });
  }

  return images;
}
