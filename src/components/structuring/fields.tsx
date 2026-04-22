"use client";

import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, hint, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-foreground">{label}</label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
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
}

export function TextArea({ value, onChange, placeholder, rows = 3, mono }: TextAreaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none",
        mono && "font-mono leading-relaxed"
      )}
      spellCheck={!mono}
    />
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
