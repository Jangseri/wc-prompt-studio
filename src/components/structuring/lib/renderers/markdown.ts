import type { StructuringPrompt } from "@/types/structuring";
import { activeConversationRules } from "../rules";

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

  const scopeLines: string[] = [];
  if (p.answerScope.rag.enabled) {
    scopeLines.push(
      `### RAG\n- 활성화됨${
        hasText(p.answerScope.rag.performanceNotes)
          ? `\n- 성능 개선 사항: ${p.answerScope.rag.performanceNotes.trim()}`
          : ""
      }`
    );
  }
  const specifics = p.answerScope.specifics;
  if (specifics.type === "keyValue" && specifics.keyValueItems.some((i) => hasText(i.key) || hasText(i.value))) {
    const kvLines = specifics.keyValueItems
      .filter((i) => hasText(i.key) || hasText(i.value))
      .map((i) => `- **${i.key.trim()}**: ${i.value.trim()}`);
    scopeLines.push(`### 특정 내용 지정\n${kvLines.join("\n")}`);
  } else if (specifics.type === "sentence" && hasText(specifics.sentence)) {
    scopeLines.push(`### 특정 내용 지정\n${specifics.sentence.trim()}`);
  }
  if (scopeLines.length > 0) {
    blocks.push(`## 대답의 범위 및 내용\n${scopeLines.join("\n\n")}`);
  }

  const branchLines: string[] = [];
  if (hasText(p.branching.description)) branchLines.push(p.branching.description.trim());
  if (hasText(p.branching.pseudoCode)) {
    branchLines.push(`\n\`\`\`\n${p.branching.pseudoCode.trim()}\n\`\`\``);
  }
  if (branchLines.length > 0) {
    blocks.push(`## 분기 처리\n${branchLines.join("\n")}`);
  }

  const toolLines: string[] = [];
  if (hasText(p.toolCalling.mcp)) toolLines.push(`- **MCP**: ${p.toolCalling.mcp.trim()}`);
  if (hasText(p.toolCalling.api)) toolLines.push(`- **API**: ${p.toolCalling.api.trim()}`);
  if (hasText(p.toolCalling.agent)) toolLines.push(`- **Agent**: ${p.toolCalling.agent.trim()}`);
  if (hasText(p.toolCalling.dataQuery))
    toolLines.push(`- **Data Query**: ${p.toolCalling.dataQuery.trim()}`);
  if (toolLines.length > 0) {
    blocks.push(`## Tool 호출 규칙\n${toolLines.join("\n")}`);
  }

  if (hasText(p.system.sttTts)) {
    blocks.push(`## System (STT/TTS)\n${p.system.sttTts.trim()}`);
  }

  const rules = activeConversationRules(p.conversation);
  const convLines: string[] = [];
  if (rules.length > 0) convLines.push(rules.map((r) => `- ${r}`).join("\n"));
  if (hasText(p.conversation.customNotes)) {
    convLines.push(`\n### 추가 사항\n${p.conversation.customNotes.trim()}`);
  }
  if (convLines.length > 0) {
    blocks.push(`## 대화 유지 규칙\n${convLines.join("\n")}`);
  }

  return blocks.join("\n\n");
}
