import type { StructuringPrompt } from "@/types/structuring";
import { activeConversationRules } from "../rules";
import {
  renderReferenceBlock,
  shouldRenderReferenceBlock,
} from "../reference-block";

const hasText = (s: string) => s.trim().length > 0;

const wrap = (tag: string, content: string) =>
  `<${tag}>\n${content.trim()}\n</${tag}>`;

export function renderXml(p: StructuringPrompt): string {
  const blocks: string[] = [];

  if (hasText(p.role.content)) {
    blocks.push(wrap("role", p.role.content));
  }

  if (hasText(p.persona.language) || hasText(p.persona.tone)) {
    const inner: string[] = [];
    if (hasText(p.persona.language)) inner.push(`  <language>${p.persona.language.trim()}</language>`);
    if (hasText(p.persona.tone)) inner.push(`  <tone>${p.persona.tone.trim()}</tone>`);
    blocks.push(`<persona>\n${inner.join("\n")}\n</persona>`);
  }

  if (hasText(p.companyInfo.description) || hasText(p.companyInfo.greeting)) {
    const inner: string[] = [];
    if (hasText(p.companyInfo.description)) {
      inner.push(`  <description>\n  ${p.companyInfo.description.trim()}\n  </description>`);
    }
    if (hasText(p.companyInfo.greeting)) {
      inner.push(`  <greeting>\n  ${p.companyInfo.greeting.trim()}\n  </greeting>`);
    }
    blocks.push(`<company_info>\n${inner.join("\n")}\n</company_info>`);
  }

  if (hasText(p.system.rules)) {
    blocks.push(wrap("system", p.system.rules));
  }

  const convoRules = activeConversationRules(p.conversation);
  if (convoRules.length > 0) {
    const ruleLines = convoRules.map((r) => `    <rule>${r}</rule>`).join("\n");
    blocks.push(
      `<conversation>\n  <rules>\n${ruleLines}\n  </rules>\n</conversation>`
    );
  }

  // toolCalling is intentionally disabled — feature not yet ready.
  // When re-enabled, restore the block here (between conversation and
  // branching, matching REGION_ORDER position 6).

  // Branching: top-level rules + numbered steps wrapped in <branching>.
  const branchInner: string[] = [];
  const branchRules = p.branching.topLevelRules.filter(hasText);
  if (branchRules.length > 0) {
    const ruleTags = branchRules
      .map((r) => `    <rule>${r.trim()}</rule>`)
      .join("\n");
    branchInner.push(`  <top_level_rules>\n${ruleTags}\n  </top_level_rules>`);
  }
  const stepTags: string[] = [];
  p.branching.steps.forEach((step, idx) => {
    if (!hasText(step.title) && !hasText(step.body)) return;
    const title = hasText(step.title)
      ? step.title.trim().replace(/"/g, "&quot;")
      : `단계 ${idx + 1}`;
    const body = hasText(step.body) ? `\n${step.body.trim()}\n    ` : "";
    stepTags.push(
      `    <step index="${idx + 1}" title="${title}">${body}</step>`
    );
  });
  if (stepTags.length > 0) {
    branchInner.push(`  <steps>\n${stepTags.join("\n")}\n  </steps>`);
  }
  if (branchInner.length > 0) {
    blocks.push(`<branching>\n${branchInner.join("\n")}\n</branching>`);
  }

  for (const item of p.custom.items) {
    if (hasText(item.tag) && hasText(item.content)) {
      const nameAttr = item.tag.trim().replace(/"/g, "&quot;");
      blocks.push(
        `<section name="${nameAttr}">\n${item.content.trim()}\n</section>`
      );
    }
  }

  // AnswerScope has no standalone output block — its RAG flag and
  // specifics all feed into the [답변 참고자료] block at the bottom.
  if (shouldRenderReferenceBlock(p)) {
    blocks.push(renderReferenceBlock(p));
  }

  return blocks.join("\n\n");
}
