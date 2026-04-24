"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepNavProps {
  /** If omitted, the "previous" slot is blank (use this for the first step). */
  onPrev?: () => void;
  prevLabel?: string;
  prevDisabled?: boolean;

  /** If omitted, the "next" slot is blank. */
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Optional hint surfaced as a title attribute when disabled. */
  nextDisabledHint?: string;
}

/**
 * Shared footer navigation for the setup / source / analysis / regions
 * steps. Keeps the visual language (quiet prev button, primary pill next
 * button with subtle hover lift) consistent across all steps.
 */
export function StepNav({
  onPrev,
  prevLabel = "이전",
  prevDisabled,
  onNext,
  nextLabel,
  nextDisabled,
  nextDisabledHint,
}: StepNavProps) {
  return (
    <div className="flex items-center justify-between border-t border-border/40 pt-3">
      {onPrev ? (
        <button
          type="button"
          onClick={onPrev}
          disabled={prevDisabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm",
            "text-muted-foreground transition-smooth",
            "hover:bg-muted hover:text-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {prevLabel}
        </button>
      ) : (
        <span />
      )}

      {onNext && nextLabel ? (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          title={nextDisabled ? nextDisabledHint : undefined}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium shadow-sm transition-all",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90 hover:shadow-md hover:-translate-y-[1px]",
            "active:translate-y-0 active:shadow-sm",
            "disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:shadow-none disabled:hover:bg-muted disabled:hover:translate-y-0 disabled:cursor-not-allowed"
          )}
        >
          {nextLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
