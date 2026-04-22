import type { StructuringPrompt, TargetLLM } from "@/types/structuring";
import { renderMarkdown } from "./renderers/markdown";
import { renderXml } from "./renderers/xml";
import { renderGemini } from "./renderers/gemini";

export function assemblePrompt(prompt: StructuringPrompt, target: TargetLLM): string {
  switch (target) {
    case "gpt":
      return renderMarkdown(prompt);
    case "claude":
      return renderXml(prompt);
    case "gemini":
      return renderGemini(prompt);
  }
}
