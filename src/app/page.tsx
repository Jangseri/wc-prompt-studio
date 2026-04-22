import Header from "@/components/layout/header";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkflowPanel } from "@/components/workspace/workflow-panel";
import { CompanySidebar } from "@/components/workspace/company-sidebar";
import { PreviewChatPanel } from "@/components/workspace/preview-chat-panel";

export default function StudioPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <WorkspaceShell
        sidebar={<CompanySidebar />}
        workflow={<WorkflowPanel />}
        preview={<PreviewChatPanel />}
      />
    </div>
  );
}
