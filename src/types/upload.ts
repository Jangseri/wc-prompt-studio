export interface ExtractedImage {
  base64: string;
  mimeType: string;
  description: string | null;
}

export interface ParsedFile {
  name: string;
  type: "xlsx" | "image";
  textContent: string | null;
  images: ExtractedImage[];
}

export interface UploadResult {
  id: string;
  files: ParsedFile[];
  detectedType: "hospital" | "general";
}
