"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { IdlePanel } from "./idle-panel";
import { WorkflowPanel } from "./workflow-panel";
import { ManagementPanel } from "./management-panel";

export function CenterPanel() {
  const mode = useWorkspaceStore((s) => s.mode);
  switch (mode) {
    case "idle":
      return <IdlePanel />;
    case "workflow":
      return <WorkflowPanel />;
    case "manage":
      return <ManagementPanel />;
  }
}
