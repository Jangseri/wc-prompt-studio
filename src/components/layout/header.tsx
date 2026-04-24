"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore, type MainTab } from "@/stores/ui-store";
import { useAutoStore } from "@/stores/auto-store";
import { useEditorStore } from "@/stores/editor-store";
import {
  Sparkles,
  Database,
  Upload,
  FileEdit,
  MessageSquare,
  LayoutGrid,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const mainTabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
  { id: "auto", label: "자동 생성", icon: <Sparkles className="h-4 w-4" /> },
  { id: "structuring", label: "정형화 (영역화)", icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "editor", label: "프롬프트 관리", icon: <Database className="h-4 w-4" /> },
];

const autoSteps = [
  { key: "upload" as const, label: "업로드", icon: Upload, num: 1 },
  { key: "edit" as const, label: "프롬프트 편집", icon: FileEdit, num: 2 },
  { key: "chat" as const, label: "대화 테스트", icon: MessageSquare, num: 3 },
];

function Logo({ tagline }: { tagline?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-[30px] h-[30px] bg-gradient-to-br from-indigo-500 to-violet-500 rounded-[10px] flex items-center justify-center">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </div>
      <div className="flex items-baseline gap-2">
        <h1 className="text-[14px] font-semibold tracking-tight gradient-text">
          WC Prompt Studio
        </h1>
        {tagline && (
          <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}

function DbStatusPill() {
  const { dbConnected, dbReason } = useEditorStore();
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-full border transition-smooth",
        dbConnected === true
          ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-400"
          : dbConnected === false
          ? "bg-red-950/30 border-red-800/40 text-red-400"
          : "bg-muted border-border text-muted-foreground"
      )}
    >
      <div
        className={cn(
          "w-[6px] h-[6px] rounded-full",
          dbConnected === true
            ? "bg-emerald-500 animate-pulse-slow"
            : dbConnected === false
            ? "bg-red-500"
            : "bg-muted-foreground"
        )}
      />
      <span className="font-medium">
        {dbConnected === true
          ? "DB 연결됨"
          : dbConnected === false
          ? `연결 실패${dbReason ? ` (${dbReason})` : ""}`
          : "확인 중..."}
      </span>
    </div>
  );
}

function CrossNavLink({ mode }: { mode: "to-legacy" | "to-main" }) {
  if (mode === "to-legacy") {
    return (
      <Link
        href="/legacy"
        className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-smooth hover:border-primary/50 hover:text-foreground"
      >
        Legacy UI
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }
  return (
    <Link
      href="/"
      className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-smooth hover:border-primary/50 hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      기본 UI
    </Link>
  );
}

function StudioHeader() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-border/50">
      <div className="flex items-center justify-between px-6 h-[54px]">
        <Logo />
        <div className="flex items-center gap-3">
          <CrossNavLink mode="to-legacy" />
          <DbStatusPill />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function LegacyHeader() {
  const { activeMainTab, setActiveMainTab } = useUIStore();
  const { currentStep, setCurrentStep, generatedPrompt } = useAutoStore();

  const canNavigateAutoStep = (step: string) => {
    if (step === "upload") return true;
    if (step === "edit") return !!generatedPrompt;
    if (step === "chat") return !!generatedPrompt;
    return false;
  };

  return (
    <header className="glass sticky top-0 z-50 border-b border-border/50">
      <div className="flex items-center justify-between px-6 h-[54px]">
        <Logo tagline="Legacy" />
        <nav className="flex items-center gap-1">
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-smooth",
                activeMainTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <CrossNavLink mode="to-main" />
          <DbStatusPill />
          <ThemeToggle />
        </div>
      </div>

      {activeMainTab === "auto" && (
        <div className="flex items-center justify-center gap-1 px-6 pb-2">
          {autoSteps.map((step, i) => {
            const isActive = currentStep === step.key;
            const isAccessible = canNavigateAutoStep(step.key);
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex items-center">
                {i > 0 && <div className="mx-2 h-px w-8 bg-border" />}
                <button
                  onClick={() => isAccessible && setCurrentStep(step.key)}
                  disabled={!isAccessible}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-smooth",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : isAccessible
                      ? "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      : "text-muted-foreground/40 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {step.num}
                  </span>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </header>
  );
}

export default function Header() {
  const pathname = usePathname();
  const isLegacy = pathname?.startsWith("/legacy") ?? false;
  return isLegacy ? <LegacyHeader /> : <StudioHeader />;
}
