"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  maxSizeMb?: number;
}

const DEFAULT_MAX_MB = 20;

export function WorkspaceFileDropzone({
  files,
  onChange,
  disabled,
  maxSizeMb = DEFAULT_MAX_MB,
}: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const max = maxSizeMb * 1024 * 1024;
      const filtered = accepted.filter((f) => f.size <= max);
      onChange([...files, ...filtered]);
    },
    [files, onChange, maxSizeMb]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    disabled,
  });

  const removeAt = (index: number) => onChange(files.filter((_, i) => i !== index));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-smooth",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-primary/5",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <input {...getInputProps()} />
        <div
          className={cn(
            "mb-3 flex h-12 w-12 items-center justify-center rounded-xl",
            isDragActive ? "bg-primary/20" : "bg-muted"
          )}
        >
          <Upload
            className={cn(
              "h-5 w-5",
              isDragActive ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>
        <p className="text-sm font-medium">
          {isDragActive ? "파일을 놓아주세요" : "파일을 드래그하거나 클릭해 업로드"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          .xlsx, .png, .jpg · 최대 {maxSizeMb} MB
        </p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => {
            const Icon = file.name.endsWith(".xlsx") ? FileSpreadsheet : ImageIcon;
            return (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(index);
                  }}
                  disabled={disabled}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  aria-label="파일 제거"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
