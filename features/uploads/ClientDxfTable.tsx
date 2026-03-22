"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trash2 } from "lucide-react";
import { deleteFile, getDxfGeometryByFile } from "@/lib/store";
import type { UploadedFile } from "@/types";
import { cn } from "@/lib/utils";

function plateNameForDxf(file: UploadedFile): string {
  const geo = getDxfGeometryByFile(file.id);
  if (geo?.guessedPartName?.trim()) return geo.guessedPartName.trim();
  return file.name.replace(/\.dxf$/i, "").trim() || file.name;
}

type ParseDot = "ok" | "warn" | "error";

function parseDotForFile(file: UploadedFile): { kind: ParseDot; label: string } {
  if (file.parseStatus === "error") {
    return { kind: "error", label: file.parseError ?? "Parse failed" };
  }
  if (file.parseStatus === "parsing" || file.parseStatus === "pending") {
    return { kind: "warn", label: "Not finished parsing" };
  }
  const geo = getDxfGeometryByFile(file.id);
  const st = geo?.processedGeometry?.status;
  if (st === "error") {
    return {
      kind: "error",
      label: geo?.processedGeometry?.statusMessage ?? "Geometry error",
    };
  }
  if (st === "warning") {
    return {
      kind: "warn",
      label: geo?.processedGeometry?.statusMessage ?? "Geometry warning",
    };
  }
  if (!geo?.processedGeometry) {
    return { kind: "warn", label: "Geometry not processed" };
  }
  return { kind: "ok", label: "Parsed OK" };
}

function ParseDot({ kind, label }: { kind: ParseDot; label: string }) {
  const color =
    kind === "ok"
      ? "bg-emerald-500"
      : kind === "warn"
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", color)}
          aria-label={label}
        />
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface ClientDxfTableProps {
  files: UploadedFile[];
  onFileDeleted?: () => void;
  emptyHint?: string;
}

export function ClientDxfTable({
  files,
  onFileDeleted,
  emptyHint = "No DXF files yet. Use Import files to add drawings.",
}: ClientDxfTableProps) {
  const dxfs = files.filter((f) => f.type === "dxf");

  if (dxfs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg bg-background/50">
        {emptyHint}
      </p>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Plate name</TableHead>
              <TableHead className="font-semibold text-center w-[72px]">
                Parsed
              </TableHead>
              <TableHead className="font-semibold text-right w-[88px]">
                Size
              </TableHead>
              <TableHead className="font-semibold w-[140px]">Uploaded</TableHead>
              <TableHead className="w-[52px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {dxfs.map((file) => {
              const dot = parseDotForFile(file);
              const uploaded = new Date(file.uploadedAt).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              });
              return (
                <TableRow key={file.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">
                    {plateNameForDxf(file)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <ParseDot kind={dot.kind} label={dot.label} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                    {formatFileSize(file.sizeBytes)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {uploaded}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        deleteFile(file.id);
                        onFileDeleted?.();
                      }}
                      aria-label={`Delete ${file.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
