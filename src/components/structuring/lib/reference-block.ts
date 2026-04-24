import type { StructuringPrompt } from "@/types/structuring";

const hasText = (s: string) => s.trim().length > 0;

/**
 * The bottom [답변 참고자료] block renders when RAG is enabled or when
 * answer-scope specifics (keyValue / sentence) have content. Keeping
 * specifics out of the regular answerScope section when the block renders
 * avoids duplication — specifics live in the block only.
 */
export function shouldRenderReferenceBlock(p: StructuringPrompt): boolean {
  const scope = p.answerScope;
  if (scope.rag.enabled) return true;
  const s = scope.specifics;
  if (s.type === "keyValue") {
    return s.keyValueItems.some((i) => hasText(i.key) || hasText(i.value));
  }
  if (s.type === "sentence") {
    return hasText(s.sentence);
  }
  return false;
}

/**
 * Plain-text block used verbatim by all renderers (markdown / xml /
 * gemini). AA1000 is a runtime placeholder for KB reference data and
 * always closes the block.
 *
 *   [답변 참고자료]
 *   <specifics if any>
 *
 *   AA1000
 */
export function renderReferenceBlock(p: StructuringPrompt): string {
  const lines: string[] = ["[답변 참고자료]"];
  const s = p.answerScope.specifics;

  let hasSpecifics = false;
  if (s.type === "keyValue") {
    const kv = s.keyValueItems.filter((i) => hasText(i.key) || hasText(i.value));
    if (kv.length > 0) {
      for (const item of kv) {
        lines.push(`- ${item.key.trim()}: ${item.value.trim()}`);
      }
      hasSpecifics = true;
    }
  } else if (s.type === "sentence" && hasText(s.sentence)) {
    lines.push(s.sentence.trim());
    hasSpecifics = true;
  }

  if (hasSpecifics) lines.push("");
  lines.push("AA1000");
  return lines.join("\n");
}
