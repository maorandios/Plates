"use client";

import { useCallback, useState } from "react";
import { FileUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import type { UploadedFileMeta } from "../types/quickQuote";

interface FileUploadCardProps {
  title: string;
  description: string;
  acceptNote: string;
  multiple?: boolean;
  files: UploadedFileMeta[];
  onFilesChange: (files: UploadedFileMeta[]) => void;
  onAddMockFiles: () => void;
  emptyHint: string;
}

export function FileUploadCard({
  title,
  description,
  acceptNote,
  multiple = false,
  files,
  onFilesChange,
  onAddMockFiles,
  emptyHint,
}: FileUploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length === 0) return;
      const mapped: UploadedFileMeta[] = dropped.map((f, i) => ({
        id: `drop-${Date.now()}-${i}`,
        name: f.name,
        sizeLabel: formatSize(f.size),
      }));
      onFilesChange(multiple ? [...files, ...mapped] : mapped.slice(0, 1));
    },
    [files, multiple, onFilesChange]
  );

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="ds-surface overflow-hidden">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-2 bg-muted/30">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {multiple && files.length > 0 && (
          <Badge variant="secondary" className="tabular-nums shrink-0">
            {formatInteger(files.length)} file{files.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div
          role="button"
          tabIndex={0}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 bg-muted/20 hover:border-muted-foreground/40"
          )}
        >
          <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{emptyHint}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" variant="default" onClick={onAddMockFiles}>
              {multiple ? "Add sample DXF files" : "Add sample Excel file"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">{acceptNote}</p>
        </div>

        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate text-foreground">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.sizeLabel}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeFile(f.id)}
                  aria-label={`Remove ${f.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${formatInteger(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatDecimal(bytes / 1024, 1)} KB`;
  return `${formatDecimal(bytes / (1024 * 1024), 1)} MB`;
}
