"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// useLayoutEffect warns during SSR; fall back to useEffect on the
// server where layout measurement isn't meaningful anyway.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  /** Optional trailing action (e.g. an expand button) rendered in the
   *  label row, after the hint. */
  action?: React.ReactNode;
}

export function Field({ label, hint, children, className, action }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <div className="flex shrink-0 items-center gap-2">
          {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function TextInput({ value, onChange, placeholder }: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
    />
  );
}

interface TextAreaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
  disabled?: boolean;
  /** When true, the textarea stretches to fill the parent flex container
   *  instead of sizing by `rows`. Parent must be flex-col with a bounded
   *  height for this to take effect. */
  fill?: boolean;
  /** When true, pressing Tab inserts a literal \t instead of moving focus.
   *  Use for code-like fields where indentation matters (e.g. branching
   *  step bodies with IF/ELSE). Shift+Tab still moves focus normally. */
  tabIndent?: boolean;
  /** When true, shows a "↗" button in the top-right that opens a large
   *  modal for editing. Edits flow back to the same onChange (auto-save).
   *  Useful for fields where the cramped card-sized textarea isn't
   *  enough — e.g. branching step bodies with complex IF/ELSE. */
  expandable?: boolean;
  /** Header label shown in the expand modal. Falls back to "확장 편집". */
  expandLabel?: string;
  /** When true, the textarea's height tracks its content (no internal
   *  scroll). `rows` still acts as the minimum visible size. Mutually
   *  exclusive with `fill`; do not combine. */
  autoResize?: boolean;
}

function textareaTabIndentHandler(
  value: string,
  onChange: (v: string) => void
) {
  return (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.substring(0, start) + "\t" + value.substring(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 1;
    });
  };
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  mono,
  disabled,
  fill,
  tabIndent,
  expandable,
  expandLabel,
  autoResize,
}: TextAreaProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: sync height to scrollHeight so the field tracks content.
  //
  // When `value` is empty we skip the scrollHeight measurement entirely
  // and let the `rows` attribute drive the natural height. Some
  // browsers (Chrome in particular) include a multi-line `placeholder`
  // in the textarea's scrollHeight, which would otherwise push empty
  // fields well above the `rows` minimum.
  //
  // For non-empty content, `void el.offsetHeight` forces a synchronous
  // layout recalc between clearing the inline height and reading
  // scrollHeight — without it, browsers can keep scrollHeight anchored
  // to the previous explicit height and the field never shrinks back.
  useIsomorphicLayoutEffect(() => {
    if (!autoResize) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    if (value.length === 0) return;
    void el.offsetHeight;
    el.style.height = `${el.scrollHeight}px`;
  }, [value, autoResize]);

  const textareaEl = (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={tabIndent ? textareaTabIndentHandler(value, onChange) : undefined}
      placeholder={placeholder}
      rows={fill ? undefined : rows}
      disabled={disabled}
      className={cn(
        "w-full rounded-md border border-border px-3 py-2 text-xs focus:border-primary focus:outline-none resize-none",
        // Text stays crisp; a muted fill + not-allowed cursor carries
        // the read-only signal on its own.
        disabled
          ? "cursor-not-allowed bg-muted text-foreground"
          : "bg-background",
        mono && "font-mono leading-relaxed",
        fill && "h-full min-h-0 flex-1",
        autoResize && "overflow-hidden",
        expandable && "pr-9"
      )}
      spellCheck={!mono}
    />
  );

  if (!expandable) return textareaEl;

  return (
    <div
      className={cn(
        "relative",
        fill && "flex min-h-0 flex-1 flex-col"
      )}
    >
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={disabled}
        title="확장해서 편집"
        className="absolute right-2 top-2 z-10 rounded-md border border-border bg-background/80 p-1 text-muted-foreground backdrop-blur transition-smooth hover:border-primary/40 hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Maximize2 className="h-3 w-3" />
      </button>
      {textareaEl}
      {modalOpen && (
        <TextAreaExpandModal
          value={value}
          onChange={onChange}
          label={expandLabel ?? "확장 편집"}
          placeholder={placeholder}
          mono={mono}
          tabIndent={tabIndent}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

interface TextAreaExpandModalProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  mono?: boolean;
  tabIndent?: boolean;
  onClose: () => void;
}

function TextAreaExpandModal({
  value,
  onChange,
  label,
  placeholder,
  mono,
  tabIndent,
  onClose,
}: TextAreaExpandModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    // Place caret at end so user can continue typing where they left off.
    const el = textareaRef.current;
    if (el) {
      el.selectionStart = el.selectionEnd = el.value.length;
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[80vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{label}</h3>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              변경은 자동 저장됩니다. ESC 또는 바깥 영역 클릭으로 닫기.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
            title="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={
              tabIndent ? textareaTabIndentHandler(value, onChange) : undefined
            }
            placeholder={placeholder}
            className={cn(
              "h-full min-h-0 flex-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none",
              mono && "font-mono leading-relaxed"
            )}
            spellCheck={!mono}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className="flex items-start gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
      />
      <span className="text-xs leading-relaxed text-muted-foreground group-hover:text-foreground transition-smooth">
        {label}
      </span>
    </label>
  );
}
