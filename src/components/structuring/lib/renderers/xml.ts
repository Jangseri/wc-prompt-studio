import type { StructuringPrompt } from "@/types/structuring";
import { activeConversationRules } from "../rules";

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

  const scopeInner: string[] = [];
  if (p.answerScope.rag.enabled) {
    const ragInner = hasText(p.answerScope.rag.performanceNotes)
      ? `    <performance_notes>${p.answerScope.rag.performanceNotes.trim()}</performance_notes>\n  `
      : "  ";
    scopeInner.push(`  <rag enabled="true">\n  ${ragInner}</rag>`);
  }
  const specifics = p.answerScope.specifics;
  if (specifics.type === "keyValue" && specifics.keyValueItems.some((i) => hasText(i.key) || hasText(i.value))) {
    const items = specifics.keyValueItems
      .filter((i) => hasText(i.key) || hasText(i.value))
      .map((i) => `    <item key="${i.key.trim()}">${i.value.trim()}</item>`)
      .join("\n");
    scopeInner.push(`  <specifics type="key_value">\n${items}\n  </specifics>`);
  } else if (specifics.type === "sentence" && hasText(specifics.sentence)) {
    scopeInner.push(`  <specifics type="sentence">\n  ${specifics.sentence.trim()}\n  </specifics>`);
  }
  if (scopeInner.length > 0) {
    blocks.push(`<answer_scope>\n${scopeInner.join("\n")}\n</answer_scope>`);
  }

  const branchInner: string[] = [];
  if (hasText(p.branching.description)) {
    branchInner.push(`  <description>${p.branching.description.trim()}</description>`);
  }
  if (hasText(p.branching.pseudoCode)) {
    branchInner.push(`  <pseudo_code>\n${p.branching.pseudoCode.trim()}\n  </pseudo_code>`);
  }
  if (branchInner.length > 0) {
    blocks.push(`<branching>\n${branchInner.join("\n")}\n</branching>`);
  }

  const toolInner: string[] = [];
  if (hasText(p.toolCalling.mcp)) toolInner.push(`  <mcp>${p.toolCalling.mcp.trim()}</mcp>`);
  if (hasText(p.toolCalling.api)) toolInner.push(`  <api>${p.toolCalling.api.trim()}</api>`);
  if (hasText(p.toolCalling.agent)) toolInner.push(`  <agent>${p.toolCalling.agent.trim()}</agent>`);
  if (hasText(p.toolCalling.dataQuery)) {
    toolInner.push(`  <data_query>${p.toolCalling.dataQuery.trim()}</data_query>`);
  }
  if (toolInner.length > 0) {
    blocks.push(`<tool_calling>\n${toolInner.join("\n")}\n</tool_calling>`);
  }

  if (hasText(p.system.sttTts)) {
    blocks.push(wrap("system", p.system.sttTts));
  }

  const rules = activeConversationRules(p.conversation);
  const convInner: string[] = [];
  if (rules.length > 0) {
    convInner.push(
      `  <rules>\n${rules.map((r) => `    <rule>${r}</rule>`).join("\n")}\n  </rules>`
    );
  }
  if (hasText(p.conversation.customNotes)) {
    convInner.push(`  <additional_notes>\n  ${p.conversation.customNotes.trim()}\n  </additional_notes>`);
  }
  if (convInner.length > 0) {
    blocks.push(`<conversation>\n${convInner.join("\n")}\n</conversation>`);
  }

  return blocks.join("\n\n");
}
