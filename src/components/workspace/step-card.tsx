"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepId } from "@/stores/workspace-store";

interface StepCardProps {
  id: StepId;
  index: number;
  title: string;
  description?: string;
  status: "current" | "done" | "pending";
  children: ReactNode;
  onExpand?: () => void;
}

export function StepCard({
  id,
  index,
  title,
  description,
  status,
  children,
  onExpand,
}: StepCardProps) {
  const isCurrent = status === "current";
  const isDone = status === "done";

  return (
    <section
      aria-labelledby={`step-${id}-title`}
      className={cn(
        "rounded-xl border transition-smooth",
        isCurrent && "border-primary/60 bg-card shadow-sm",
        isDone && "border-border/60 bg-card/40",
        status === "pending" && "border-border/40 bg-card/20"
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3 px-5 py-4",
          !isCurrent && onExpand && "cursor-pointer"
        )}
        onClick={!isCurrent ? onExpand : undefined}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            isCurrent && "bg-primary text-primary-foreground",
            isDone && "bg-primary/10 text-primary",
            status === "pending" && "bg-muted text-muted-foreground"
          )}
          aria-hidden="true"
        >
          {isDone ? <Check className="h-3.5 w-3.5" /> : index}
        </span>
        <div className="flex-1 min-w-0">
          <h3
            id={`step-${id}-title`}
            className={cn(
              "text-sm font-semibold tracking-tight",
              !isCurrent && "text-muted-foreground"
            )}
          >
            {title}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {!isCurrent && onExpand && (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </header>
      {isCurrent && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </section>
  );
}
