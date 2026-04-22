import type { ReactNode } from "react";

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
 * Collapses to a single column under lg.
 */
export function WorkspaceShell({ sidebar, workflow, preview }: WorkspaceShellProps) {
  return (
    <div className="grid gap-4 p-4 min-h-[calc(100vh-54px)] grid-cols-1 lg:grid-cols-[18rem_1fr_24rem] xl:grid-cols-[20rem_1fr_26rem]">
      <aside className="rounded-xl border border-border/60 bg-card/40 p-4 min-h-0 overflow-hidden">
        {sidebar}
      </aside>
      <section className="rounded-xl border border-border/60 bg-card/40 p-6 min-h-0 overflow-auto">
        {workflow}
      </section>
      <aside className="rounded-xl border border-border/60 bg-card/40 p-4 lg:sticky lg:top-[70px] lg:self-start lg:h-[calc(100vh-86px)] overflow-auto">
        {preview}
      </aside>
    </div>
  );
}
