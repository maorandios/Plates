"use client";

import { File, FileSpreadsheet, Trash2, AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTypeBadge } from "@/components/shared/StatusBadge";
import { deleteFile } from "@/lib/store";
import type { UploadedFile } from "@/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FileListProps {
  files: UploadedFile[];
  onFileDeleted?: (fileId: string) => void;
}

export function FileList({ files, onFileDeleted }: FileListProps) {
  if (files.length === 0) return null;

  function handleDelete(fileId: string) {
    deleteFile(fileId);
    onFileDeleted?.(fileId);
  }

  return (
    <div className="space-y-1.5">
      {files.map((file) => (
        <FileRow key={file.id} file={file} onDelete={handleDelete} />
      ))}
    </div>
  );
}

function FileRow({
  file,
  onDelete,
}: {
  file: UploadedFile;
  onDelete: (id: string) => void;
}) {
  const Icon = file.type === "excel" ? FileSpreadsheet : File;

  const hasWarnings =
    file.parseWarnings && file.parseWarnings.length > 0;
  const noRowsParsed =
    file.parseStatus === "parsed" &&
    file.type === "excel" &&
    file.parsedRowCount === 0;

  return (
    <TooltipProvider>
      <div
        className={cn(
          "rounded-lg border bg-card text-sm group overflow-hidden",
          noRowsParsed
            ? "border-amber-200"
            : file.parseStatus === "error"
            ? "border-red-200"
            : "border-border"
        )}
      >
        <div className="flex items-center gap-3 px-3 py-2">
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              file.type === "excel" ? "text-emerald-600" : "text-indigo-600"
            )}
          />
          <span className="flex-1 truncate font-medium text-foreground">
            {file.name}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {(file.sizeBytes / 1024).toFixed(0)} KB
          </span>
          <FileTypeBadge type={file.type} />

          {/* Status indicator */}
          {file.parseStatus === "parsing" && (
            <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse shrink-0" />
          )}
          {file.parseStatus === "parsed" && !noRowsParsed && !hasWarnings && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          )}
          {(noRowsParsed || (file.parseStatus === "parsed" && hasWarnings)) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">
                  {noRowsParsed ? "0 rows extracted" : "Parsed with warnings"}
                </p>
                <ul className="space-y-0.5">
                  {file.parseWarnings?.map((w, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      {w}
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
          {file.parseStatus === "error" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{file.parseError ?? "Parse failed"}</p>
              </TooltipContent>
            </Tooltip>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onDelete(file.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Parse summary row */}
        {file.parseStatus === "parsed" && file.type === "excel" && (
          <div
            className={cn(
              "px-3 py-1.5 text-xs border-t flex items-center gap-2",
              noRowsParsed
                ? "bg-amber-50 border-amber-100 text-amber-700"
                : "bg-muted/30 border-border text-muted-foreground"
            )}
          >
            {noRowsParsed ? (
              <>
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>
                  No rows extracted — column headers were not recognised.{" "}
                  {file.parseWarnings?.[0]}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                <span>
                  <strong>{file.parsedRowCount}</strong> row
                  {file.parsedRowCount !== 1 ? "s" : ""} extracted
                  {hasWarnings && (
                    <span className="text-amber-600 ml-1">
                      · {file.parseWarnings!.length} warning
                      {file.parseWarnings!.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </span>
              </>
            )}
          </div>
        )}

        {/* Error message */}
        {file.parseStatus === "error" && file.parseError && (
          <div className="px-3 py-1.5 text-xs border-t bg-red-50 border-red-100 text-red-700">
            {file.parseError}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
