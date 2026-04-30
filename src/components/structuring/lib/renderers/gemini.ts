import type { StructuringPrompt } from "@/types/structuring";
import { activeConversationRules } from "../rules";
import {
  renderReferenceBlock,
  shouldRenderReferenceBlock,
} from "../reference-block";

const hasText = (s: string) => s.trim().length > 0;

const DIVIDER = "---";

function section(title: string, body: string): string {
  return `${DIVIDER}\n# ${title}\n${DIVIDER}\n${body.trim()}`;
}

export function renderGemini(p: StructuringPrompt): string {
  const blocks: string[] = [];

  if (hasText(p.role.content)) {
    blocks.push(section("ROLE", p.role.content));
  }

  if (hasText(p.persona.language) || hasText(p.persona.tone)) {
    const lines: string[] = [];
    if (hasText(p.persona.language)) lines.push(`Language: ${p.persona.language.trim()}`);
    if (hasText(p.persona.tone)) lines.push(`Tone(어투): ${p.persona.tone.trim()}`);
    blocks.push(section("PERSONA", lines.join("\n")));
  }

  if (hasText(p.companyInfo.description) || hasText(p.companyInfo.greeting)) {
    const lines: string[] = [];
    if (hasText(p.companyInfo.description)) lines.push(p.companyInfo.description.trim());
    if (hasText(p.companyInfo.greeting)) {
      lines.push(`\n## 인사말\n${p.companyInfo.greeting.trim()}`);
    }
    blocks.push(section("업무 및 회사 정보", lines.join("\n")));
  }

  if (hasText(p.system.rules)) {
    blocks.push(section("SYSTEM", p.system.rules));
  }

  const convoRules = activeConversationRules(p.conversation);
  if (convoRules.length > 0) {
    blocks.push(section("대화 유지 규칙", convoRules.map((r) => `- ${r}`).join("\n")));
  }

  // toolCalling is intentionally disabled — feature not yet ready.
  // When re-enabled, restore the block here (between conversation and
  // branching, matching REGION_ORDER position 6).

  // Branching: top-level rules + numbered steps, wrapped in a single
  // section() block (---# 대화 흐름 ---) with rules and steps as h2s.
  const branchLines: string[] = [];
  const gRules = p.branching.topLevelRules.filter(hasText);
  if (gRules.length > 0) {
    branchLines.push(
      `## 절대 금지 규칙\n${gRules.map((r) => `- ${r.trim()}`).join("\n")}`
    );
  }
  p.branching.steps.forEach((step, idx) => {
    if (!hasText(step.title) && !hasText(step.body)) return;
    const title = hasText(step.title) ? step.title.trim() : `단계 ${idx + 1}`;
    const header = `## ${idx + 1}) ${title}`;
    branchLines.push(
      hasText(step.body) ? `${header}\n${step.body.trim()}` : header
    );
  });
  if (branchLines.length > 0) {
    blocks.push(section("대화 흐름", branchLines.join("\n\n")));
  }

  for (const item of p.custom.items) {
    if (hasText(item.tag) && hasText(item.content)) {
      blocks.push(section(item.tag.trim(), item.content));
    }
  }

  // AnswerScope has no standalone output block — its RAG flag and
  // specifics all feed into the [답변 참고자료] block at the bottom.
  if (shouldRenderReferenceBlock(p)) {
    blocks.push(renderReferenceBlock(p));
  }

  return blocks.join("\n\n");
}
