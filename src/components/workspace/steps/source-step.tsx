"use client";

import { useState } from "react";
import type { Channel } from "@/lib/prompt-codes";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceFileDropzone } from "../workspace-file-dropzone";

const DEFAULT_INDUSTRIES = ["병원", "보험", "금융", "리테일", "공공", "기타"] as const;

export function SourceStep() {
  const sourceFiles = useWorkspaceStore((s) => s.sourceFiles);
  const setSourceFiles = useWorkspaceStore((s) => s.setSourceFiles);
  const channel = useWorkspaceStore((s) => s.channel);
  const setChannel = useWorkspaceStore((s) => s.setChannel);
  const industry = useWorkspaceStore((s) => s.industry);
  const setIndustry = useWorkspaceStore((s) => s.setIndustry);
  const isParsing = useWorkspaceStore((s) => s.isParsing);
  const goPrev = useWorkspaceStore((s) => s.goPrev);
  const goNext = useWorkspaceStore((s) => s.goNext);
  const canAdvance = useWorkspaceStore((s) => s.canAdvanceFrom("source"));

  const [customIndustry, setCustomIndustry] = useState(
    !DEFAULT_INDUSTRIES.includes(industry as (typeof DEFAULT_INDUSTRIES)[number]) &&
      industry !== ""
  );

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">
          소스 파일 (엑셀 · 플로우차트 이미지)
        </label>
        <WorkspaceFileDropzone
          files={sourceFiles}
          onChange={setSourceFiles}
          disabled={isParsing}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">채널</legend>
        <div className="flex gap-2">
          {(["callbot", "chatbot"] as Channel[]).map((c) => (
            <label
              key={c}
              className={`flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-smooth ${
                channel === c
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="channel"
                value={c}
                checked={channel === c}
                onChange={() => setChannel(c)}
                className="sr-only"
              />
              {c === "callbot" ? "콜봇 (SA1000 · PD2000)" : "챗봇 (SA2000 · PD0000)"}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">업종</legend>
        {!customIndustry ? (
          <div className="flex items-center gap-2">
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            >
              <option value="">선택하세요</option>
              {DEFAULT_INDUSTRIES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setCustomIndustry(true);
                setIndustry("");
              }}
              className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40"
            >
              직접입력
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="업종을 입력하세요"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <button
              type="button"
              onClick={() => {
                setCustomIndustry(false);
                setIndustry("");
              }}
              className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40"
            >
              목록에서 선택
            </button>
          </div>
        )}
      </fieldset>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary/40"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canAdvance}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음: 분석 →
        </button>
      </div>
    </div>
  );
}
