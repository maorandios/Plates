"use client";

import {
  File,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-2">
      {files.map((file) => (
        <FileRow key={file.id} file={file} onDelete={handleDelete} />
      ))}
    </div>
  );
}

function parseStatusLabel(file: UploadedFile): string {
  switch (file.parseStatus) {
    case "parsed":
      return "Parsed";
    case "error":
      return "Error";
    case "parsing":
      return "Parsing";
    default:
      return "Pending";
  }
}

function ParseStatusBadge({ file }: { file: UploadedFile }) {
  const label = parseStatusLabel(file);
  if (file.parseStatus === "parsed") {
    return (
      <Badge variant="secondary" className="text-[10px] font-medium bg-emerald-50 text-emerald-800 border-emerald-200">
        {label}
      </Badge>
    );
  }
  if (file.parseStatus === "error") {
    return (
      <Badge variant="secondary" className="text-[10px] font-medium bg-red-50 text-red-800 border-red-200">
        {label}
      </Badge>
    );
  }
  if (file.parseStatus === "parsing") {
    return (
      <Badge variant="secondary" className="text-[10px] font-medium bg-amber-50 text-amber-900 border-amber-200">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
      {label}
    </Badge>
  );
}

function DxfUnitBadge({ file }: { file: UploadedFile }) {
  const label = file.detectedUnitLabel ?? "Unknown";
  const u = file.detectedUnit ?? "unknown";
  const canonical =
    u === "mm" || u === "in" || u === "cm" || u === "m" || u === "ft";
  const noHeaderData = label === "Unknown";
  return (
    <Badge
      variant={canonical ? "secondary" : "outline"}
      className={cn(
        "text-[10px] font-medium",
        noHeaderData && "border-amber-300 bg-amber-50 text-amber-900",
        u === "unitless" && "border-border bg-muted/50 text-muted-foreground",
        !canonical &&
          !noHeaderData &&
          u === "unknown" &&
          "border-border bg-muted/40 text-foreground"
      )}
    >
      {label}
    </Badge>
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

  const uploadedLabel = new Date(file.uploadedAt).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

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
        <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                file.type === "excel" ? "text-emerald-600" : "text-indigo-600"
              )}
            />
            <span className="truncate font-medium text-foreground">{file.name}</span>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {(file.sizeBytes / 1024).toFixed(0)} KB
            </span>
            <FileTypeBadge type={file.type} />
          </div>

          {file.type === "dxf" && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end pl-7 sm:pl-0">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground hidden sm:inline">
                Parse
              </span>
              <ParseStatusBadge file={file} />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground hidden sm:inline">
                DXF units
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <DxfUnitBadge file={file} />
                  </span>
                </TooltipTrigger>
                {file.detectedUnitSource && (
                  <TooltipContent className="max-w-xs text-xs">
                    Source: {file.detectedUnitSource}
                    {(file.detectedUnitLabel ?? "Unknown") === "Unknown" && (
                      <span className="block mt-1 text-amber-800">
                        No $INSUNITS in header (or file is binary / non‑DXF ASCII). Confirm units in
                        CAD if dimensions look wrong.
                      </span>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
              <span className="text-xs text-muted-foreground tabular-nums">{uploadedLabel}</span>
            </div>
          )}

          {file.type === "excel" && (
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto pl-7 sm:pl-0">
              <ParseStatusBadge file={file} />
              <span className="text-xs text-muted-foreground tabular-nums">{uploadedLabel}</span>
            </div>
          )}

          <div className="flex items-center gap-2 sm:shrink-0 pl-7 sm:pl-0 sm:ml-0">
            {file.parseStatus === "parsing" && (
              <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse shrink-0" />
            )}
            {file.parseStatus === "parsed" && !noRowsParsed && !hasWarnings && file.type === "excel" && (
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
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 sm:ml-1"
              onClick={() => onDelete(file.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

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

        {file.parseStatus === "error" && file.parseError && (
          <div className="px-3 py-1.5 text-xs border-t bg-red-50 border-red-100 text-red-700">
            {file.parseError}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
