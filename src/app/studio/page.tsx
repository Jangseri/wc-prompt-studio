import Header from "@/components/layout/header";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkflowPanel } from "@/components/workspace/workflow-panel";

export default function StudioPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <WorkspaceShell
        sidebar={<SidebarPlaceholder />}
        workflow={<WorkflowPanel />}
        preview={<PreviewPlaceholder />}
      />
    </div>
  );
}

function SidebarPlaceholder() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Companies
        </h2>
        <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          step 7
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        회사별로 적용된 프롬프트 목록이 여기에 표시됩니다. 사이드바는 §8 step 7에서
        붙습니다.
      </p>
    </div>
  );
}

function PreviewPlaceholder() {
  const tabs = ["Preview", "Chat", "KB"];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Right panel
        </h2>
        <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          step 7
        </span>
      </div>
      <div className="flex items-center gap-1 rounded-md border border-border/50 p-1">
        {tabs.map((t, i) => (
          <span
            key={t}
            className={
              i === 0
                ? "flex-1 rounded px-2 py-1 text-center text-xs font-medium bg-muted text-foreground"
                : "flex-1 rounded px-2 py-1 text-center text-xs text-muted-foreground"
            }
          >
            {t}
          </span>
        ))}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        8영역 직렬화 미리보기, `/api/chat` 스트리밍 테스트, 선택한 회사의 KB 뷰어가
        탭 전환으로 표시됩니다.
      </p>
    </div>
  );
}
