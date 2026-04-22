"use client";

import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStructuringStore } from "@/stores/structuring-store";
import { REGION_META, type RegionId } from "@/types/structuring";
import { isRegionFilled } from "./lib/is-filled";
import {
  RoleSection,
  PersonaSection,
  CompanyInfoSection,
  AnswerScopeSection,
  BranchingSection,
  ToolCallingSection,
  SystemSection,
  ConversationSection,
} from "./regions";

function RegionBody({ id }: { id: RegionId }) {
  const prompt = useStructuringStore((s) => s.prompt);
  switch (id) {
    case "role":
      return <RoleSection value={prompt.role} />;
    case "persona":
      return <PersonaSection value={prompt.persona} />;
    case "companyInfo":
      return <CompanyInfoSection value={prompt.companyInfo} />;
    case "answerScope":
      return <AnswerScopeSection value={prompt.answerScope} />;
    case "branching":
      return <BranchingSection value={prompt.branching} />;
    case "toolCalling":
      return <ToolCallingSection value={prompt.toolCalling} />;
    case "system":
      return <SystemSection value={prompt.system} />;
    case "conversation":
      return <ConversationSection value={prompt.conversation} />;
  }
}

export function RegionCard({ id }: { id: RegionId }) {
  const meta = REGION_META[id];
  const expanded = useStructuringStore((s) => s.expandedRegions.has(id));
  const toggle = useStructuringStore((s) => s.toggleRegion);
  const filled = useStructuringStore((s) => isRegionFilled(s.prompt, id));

  return (
    <div
      className={cn(
        "rounded-xl border bg-card overflow-hidden transition-smooth",
        expanded ? "border-primary/40" : "border-border hover:border-primary/30"
      )}
    >
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-smooth",
              filled
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {filled ? <Check className="h-3.5 w-3.5" /> : "·"}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{meta.label}</h3>
            <p className="text-[11px] text-muted-foreground truncate">{meta.description}</p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4">
          <RegionBody id={id} />
        </div>
      )}
    </div>
  );
}
