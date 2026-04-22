"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, Image, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutoStore } from "@/stores/auto-store";

export default function FileDropzone() {
  const { uploadedFiles, setUploadedFiles, isUploading } = useAutoStore();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setUploadedFiles([...uploadedFiles, ...acceptedFiles]);
    },
    [uploadedFiles, setUploadedFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    disabled: isUploading,
  });

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.name.endsWith(".xlsx")) return FileSpreadsheet;
    return Image;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-smooth",
          isDragActive
            ? "border-primary bg-primary/5 glow-primary"
            : "border-border hover:border-primary/50 hover:bg-primary/5",
          isUploading && "pointer-events-none opacity-50"
        )}
      >
        <input {...getInputProps()} />
        <div
          className={cn(
            "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-smooth",
            isDragActive ? "bg-primary/20" : "bg-muted"
          )}
        >
          <Upload
            className={cn(
              "h-8 w-8 transition-smooth",
              isDragActive ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>
        <p className="mb-1 text-base font-medium">
          {isDragActive ? "파일을 놓아주세요!" : "파일을 드래그하거나 클릭하여 업로드"}
        </p>
        <p className="text-sm text-muted-foreground">
          .xlsx, .png, .jpg 파일 지원
        </p>
      </div>

      {/* File list */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            업로드된 파일 ({uploadedFiles.length})
          </p>
          {uploadedFiles.map((file, index) => {
            const Icon = getFileIcon(file);
            return (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-smooth hover:border-primary/30"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
