"use client";

import { Fragment, type ReactNode } from "react";
import { useEffect, useState } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface WorkspaceShellProps {
  sidebar: ReactNode;
  workflow: ReactNode;
  preview: ReactNode;
}

/**
 * 3-column layout for /studio.
 *  LEFT (20rem): companies sidebar
 *  CENTER (flex-1): workflow steps
 *  RIGHT (26rem, sticky): preview / chat / kb
 *
 * Collapses to a single column under lg. In `workflow` mode the sidebar
 * is hidden by default — the center panel gets the extra width — but
 * the user can pop it back in via a sticky toggle button at the top of
 * the center section. The toggle state resets whenever the user leaves
 * workflow mode so a fresh workflow always starts sidebar-collapsed.
 */
export function WorkspaceShell({ sidebar, workflow, preview }: WorkspaceShellProps) {
  const mode = useWorkspaceStore((s) => s.mode);
  const autoHide = mode === "workflow";
  const [showInWorkflow, setShowInWorkflow] = useState(false);

  useEffect(() => {
    if (!autoHide) setShowInWorkflow(false);
  }, [autoHide]);

  const sidebarVisible = !autoHide || showInWorkflow;

  return (
    <div
      className={cn(
        "grid gap-4 p-4 min-h-[calc(100vh-54px)] grid-cols-1",
        sidebarVisible
          ? "lg:grid-cols-[18rem_1fr_24rem] xl:grid-cols-[20rem_1fr_26rem]"
          : "lg:grid-cols-[1fr_24rem] xl:grid-cols-[1fr_26rem]"
      )}
    >
      {sidebarVisible && (
        <aside className="rounded-xl border border-border/60 bg-card/40 p-4 overflow-hidden lg:sticky lg:top-[70px] lg:self-start lg:h-[calc(100vh-86px)]">
          {sidebar}
        </aside>
      )}
      <section className="flex flex-col rounded-xl border border-border/60 bg-card/40 overflow-auto lg:sticky lg:top-[70px] lg:self-start lg:h-[calc(100vh-86px)]">
        {autoHide && (
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/40 bg-card/80 px-4 py-2 backdrop-blur">
            <button
              type="button"
              onClick={() => setShowInWorkflow((v) => !v)}
              title={showInWorkflow ? "회사 목록 닫기" : "회사 목록 열기"}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground"
            >
              {showInWorkflow ? (
                <PanelLeftClose className="h-3.5 w-3.5" />
              ) : (
                <PanelLeft className="h-3.5 w-3.5" />
              )}
              {showInWorkflow ? "회사 목록 닫기" : "회사 목록"}
            </button>
            <WorkflowContextSummary />
          </div>
        )}
        <div className="flex-1 p-6">{workflow}</div>
      </section>
      <aside className="rounded-xl border border-border/60 bg-card/40 p-4 lg:sticky lg:top-[70px] lg:self-start lg:h-[calc(100vh-86px)] overflow-auto">
        {preview}
      </aside>
    </div>
  );
}

/**
 * Sticky-bar companion that surfaces the current workflow's identity
 * (company · staff · channel · industry) so the user always sees their
 * Setup/Source context while scrolling through Analysis / Regions /
 * Apply. Fields appear as they're filled — an empty Setup renders
 * nothing.
 */
function WorkflowContextSummary() {
  const companySeq = useWorkspaceStore((s) => s.companySeq);
  const aiStaffSeq = useWorkspaceStore((s) => s.aiStaffSeq);
  const channel = useWorkspaceStore((s) => s.channel);
  const industry = useWorkspaceStore((s) => s.industry);

  const parts: ReactNode[] = [];
  if (companySeq.trim()) {
    parts.push(
      <span key="company">
        <span className="text-muted-foreground">company</span>{" "}
        <span className="font-mono text-foreground/80">{companySeq}</span>
      </span>
    );
  }
  if (aiStaffSeq.trim()) {
    parts.push(
      <span key="staff">
        <span className="text-muted-foreground">staff</span>{" "}
        <span className="font-mono text-foreground/80">{aiStaffSeq}</span>
      </span>
    );
  }
  if (channel) {
    parts.push(
      <span key="channel" className="text-foreground/80">
        {channel === "callbot" ? "콜봇" : "챗봇"}
      </span>
    );
  }
  if (industry.trim()) {
    parts.push(
      <span key="industry" className="text-foreground/80">
        {industry}
      </span>
    );
  }

  if (parts.length === 0) return null;

  return (
    <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-muted-foreground/50">·</span>}
          {part}
        </Fragment>
      ))}
    </div>
  );
}
