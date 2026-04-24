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
    case "branching": {
      const b = prompt.branching;
      if (b.topLevelRules.some(has)) return true;
      return b.steps.some((step) => has(step.title) || has(step.body));
    }
    case "toolCalling": {
      const t = prompt.toolCalling;
      return has(t.mcp) || has(t.api) || has(t.agent) || has(t.dataQuery);
    }
    case "system":
      return has(prompt.system.sttTts);
    case "conversation": {
      const c = prompt.conversation;
      // customNotes is no longer edited via the conversation card — the
      // standalone "custom" region carries free-form content now.
      return Object.values(c.rules).some(Boolean);
    }
    case "custom":
      return prompt.custom.items.some(
        (item) => has(item.tag) || has(item.content)
      );
  }
}
