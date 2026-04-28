"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** 모달 헤더 제목 (예: "엑셀 텍스트", "이미지 1 분석"). */
  title: string;
  /** 표시할 본문 텍스트. read-only — 모달에서 편집 불가. */
  content: string;
  /** ESC, 외부 클릭, X 버튼이 모두 호출. */
  onClose: () => void;
}

/**
 * 긴 분석 결과를 풀화면에 가까운 크기로 보여주는 read-only 미리보기
 * 모달. 편집은 호출 측의 인라인 textarea 에서만 가능. 모달은 단순
 * 표시 + 복사 용도.
 *
 * createPortal 로 document.body 에 직접 마운트해서, sticky / transform
 * 같은 ancestor 의 stacking context 영향을 받지 않게 함.
 */
export function ExpandModal({ title, content, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  // ESC 키 닫기 + body 스크롤 잠금
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("복사됨");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사에 실패했습니다");
    }
  }, [content]);

  // SSR 가드: createPortal 은 document 가 필요.
  if (typeof document === "undefined") return null;

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(72rem, calc(100vw - 2rem))",
          height: "calc(100vh - 2rem)",
        }}
        className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="truncate text-sm font-semibold text-foreground"
              title={title}
            >
              {title}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {content.length.toLocaleString()}자
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!content}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
              aria-label="복사"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "복사됨" : "복사"}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="닫기 (ESC)"
              aria-label="닫기"
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-xs text-muted-foreground transition-all hover:border-red-500/40 hover:bg-red-600/10 hover:text-red-600 dark:hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" />
              닫기 (ESC)
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-5">
          {content ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
              {content}
            </pre>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              내용이 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
