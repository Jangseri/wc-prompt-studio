"use client";

import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStep {
  label: string;
  status: "pending" | "active" | "done";
}

interface UploadProgressProps {
  steps: ProgressStep[];
}

export default function UploadProgress({ steps }: UploadProgressProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        처리 진행 상태
      </h3>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            {step.status === "done" ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : step.status === "active" ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
            )}
            <span
              className={cn(
                "text-sm",
                step.status === "done"
                  ? "text-foreground"
                  : step.status === "active"
                    ? "text-primary font-medium"
                    : "text-muted-foreground/50"
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
