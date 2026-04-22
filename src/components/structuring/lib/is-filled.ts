import type { RegionId, StructuringPrompt } from "@/types/structuring";

const has = (s: string) => s.trim().length > 0;

export function isRegionFilled(prompt: StructuringPrompt, id: RegionId): boolean {
  switch (id) {
    case "role":
      return has(prompt.role.content);
    case "persona":
      return has(prompt.persona.language) || has(prompt.persona.tone);
    case "companyInfo":
      return has(prompt.companyInfo.description) || has(prompt.companyInfo.greeting);
    case "answerScope": {
      const s = prompt.answerScope;
      if (s.rag.enabled) return true;
      if (s.specifics.type === "sentence") return has(s.specifics.sentence);
      return s.specifics.keyValueItems.some((i) => has(i.key) || has(i.value));
    }
    case "branching":
      return has(prompt.branching.description) || has(prompt.branching.pseudoCode);
    case "toolCalling": {
      const t = prompt.toolCalling;
      return has(t.mcp) || has(t.api) || has(t.agent) || has(t.dataQuery);
    }
    case "system":
      return has(prompt.system.sttTts);
    case "conversation": {
      const c = prompt.conversation;
      return Object.values(c.rules).some(Boolean) || has(c.customNotes);
    }
  }
}
