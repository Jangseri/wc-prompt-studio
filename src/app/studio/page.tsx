import Header from "@/components/layout/header";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default function StudioPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <WorkspaceShell
        sidebar={<SidebarPlaceholder />}
        workflow={<WorkflowPlaceholder />}
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

function WorkflowPlaceholder() {
  const steps = [
    { n: 1, title: "Setup", hint: "company_seq / ai_staff_seq" },
    { n: 2, title: "Source", hint: "파일 업로드 · 채널 · 업종" },
    { n: 3, title: "Analysis", hint: "업로드 결과 확인 후 초안 생성" },
    { n: 4, title: "Regions", hint: "8영역 편집 (기존 region-grid 재사용)" },
    { n: 5, title: "Apply", hint: "DB 저장 (트랜잭션 · 형제 3개)" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Workflow</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          통합 워크스페이스 스켈레톤 · 실제 스텝 UI는 §8 step 6부터 채워집니다.
        </p>
      </div>
      <ol className="space-y-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex items-start gap-3 rounded-lg border border-border/50 p-3"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {s.n}
            </span>
            <div>
              <p className="text-sm font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </div>
          </li>
        ))}
      </ol>
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
