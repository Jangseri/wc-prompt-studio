import type { StructuringPrompt } from "@/types/structuring";
import { activeConversationRules } from "../rules";
import {
  renderReferenceBlock,
  shouldRenderReferenceBlock,
} from "../reference-block";

const hasText = (s: string) => s.trim().length > 0;

export function renderMarkdown(p: StructuringPrompt): string {
  const blocks: string[] = [];

  if (hasText(p.role.content)) {
    blocks.push(`## Role\n${p.role.content.trim()}`);
  }

  if (hasText(p.persona.language) || hasText(p.persona.tone)) {
    const lines: string[] = [];
    if (hasText(p.persona.language)) lines.push(`- **Language**: ${p.persona.language.trim()}`);
    if (hasText(p.persona.tone)) lines.push(`- **어투**: ${p.persona.tone.trim()}`);
    blocks.push(`## Persona\n${lines.join("\n")}`);
  }

  if (hasText(p.companyInfo.description) || hasText(p.companyInfo.greeting)) {
    const lines: string[] = [];
    if (hasText(p.companyInfo.description)) lines.push(p.companyInfo.description.trim());
    if (hasText(p.companyInfo.greeting)) {
      lines.push(`\n### 인사말\n${p.companyInfo.greeting.trim()}`);
    }
    blocks.push(`## 업무 및 회사 정보\n${lines.join("\n")}`);
  }

  if (hasText(p.system.sttTts)) {
    blocks.push(`## System (STT/TTS)\n${p.system.sttTts.trim()}`);
  }

  const convoRules = activeConversationRules(p.conversation);
  if (convoRules.length > 0) {
    blocks.push(`## 대화 유지 규칙\n${convoRules.map((r) => `- ${r}`).join("\n")}`);
  }

  // toolCalling is intentionally disabled — feature not yet ready.
  // When re-enabled, restore the block here (between conversation rules
  // and branching, matching REGION_ORDER position 6).

  // Branching: top-level rules + numbered steps. The most critical
  // section for dialog flow — format matches the proven production
  // prompt shape (numbered steps, verbatim scripts, IF/ELSE blocks).
  const branchBlocks: string[] = [];
  const topLevelRules = p.branching.topLevelRules.filter(hasText);
  if (topLevelRules.length > 0) {
    branchBlocks.push(
      `### 절대 금지 규칙\n${topLevelRules.map((r) => `- ${r.trim()}`).join("\n")}`
    );
  }
  p.branching.steps.forEach((step, idx) => {
    if (!hasText(step.title) && !hasText(step.body)) return;
    const title = hasText(step.title) ? step.title.trim() : `단계 ${idx + 1}`;
    const header = `### ${idx + 1}) ${title}`;
    branchBlocks.push(
      hasText(step.body) ? `${header}\n${step.body.trim()}` : header
    );
  });
  if (branchBlocks.length > 0) {
    blocks.push(`## 대화 흐름\n\n${branchBlocks.join("\n\n")}`);
  }

  for (const item of p.custom.items) {
    if (hasText(item.tag) && hasText(item.content)) {
      blocks.push(`## ${item.tag.trim()}\n${item.content.trim()}`);
    }
  }

  // AnswerScope has no standalone output block — its RAG flag and
  // specifics all feed into the [답변 참고자료] block at the bottom.
  if (shouldRenderReferenceBlock(p)) {
    blocks.push(renderReferenceBlock(p));
  }

  return blocks.join("\n\n");
}
