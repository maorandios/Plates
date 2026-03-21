"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileTypeBadge } from "@/components/shared/StatusBadge";
import {
  saveFile,
  saveFileData,
  saveExcelRows,
  saveDxfGeometry,
  getFileById,
} from "@/lib/store";
import { nanoid } from "@/lib/utils/nanoid";
import {
  readExcelHeaders,
  parseExcelFileWithMapping,
  type ExcelHeadersResult,
} from "@/lib/parsers/excelParser";
import { parseDxfFile } from "@/lib/parsers/dxfParser";
import { ColumnMappingDialog } from "./ColumnMappingDialog";
import type { ColumnMapping, UploadedFile, FileType } from "@/types";

interface FileUploadZoneProps {
  clientId: string;
  batchId: string;
  onFilesUploaded?: (files: UploadedFile[]) => void;
}

interface PendingFile {
  file: File;
  type: FileType;
  status: "pending" | "parsing" | "done" | "error";
  error?: string;
}

/** Queued Excel file waiting for the user to confirm column mapping */
interface PendingExcelMapping {
  file: File;
  arrayBuffer: ArrayBuffer;
  headersResult: ExcelHeadersResult;
}

function detectFileType(file: File): FileType | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".dxf")) return "dxf";
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv"))
    return "excel";
  return null;
}

export function FileUploadZone({
  clientId,
  batchId,
  onFilesUploaded,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Excel mapping dialog state
  const [mappingQueue, setMappingQueue] = useState<PendingExcelMapping[]>([]);
  const currentMapping = mappingQueue[0] ?? null;

  // ── DXF processing (unchanged) ──────────────────────────────────────────
  const processDxfFile = useCallback(
    async (
      file: File,
      queueIdx: number,
      totalInBatch: number
    ): Promise<UploadedFile | null> => {
      let currentFileId = "";
      try {
        const fileId = nanoid();
        currentFileId = fileId;
        const dataKey = `${clientId}_${fileId}`;

        const uploadedFile: UploadedFile = {
          id: fileId,
          clientId,
          batchId,
          name: file.name,
          type: "dxf",
          sizeBytes: file.size,
          parseStatus: "parsing",
          uploadedAt: new Date().toISOString(),
          dataKey,
        };

        saveFile(uploadedFile);

        const arrayBuffer = await file.arrayBuffer();
        const text = new TextDecoder("utf-8").decode(arrayBuffer);
        saveFileData(dataKey, text);

        const result = parseDxfFile(text, fileId, file.name, clientId, batchId);
        saveDxfGeometry({ ...result.geometry, id: nanoid() });

        const updated: UploadedFile = {
          ...uploadedFile,
          parseStatus: "parsed",
          parsedRowCount: result.geometry.entityCount,
          parseWarnings: result.warnings.length > 0 ? result.warnings : undefined,
        };
        saveFile(updated);

        setPendingFiles((prev) =>
          prev.map((f, idx) =>
            idx === prev.length - totalInBatch + queueIdx
              ? { ...f, status: "done" }
              : f
          )
        );

        return updated;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setPendingFiles((prev) =>
          prev.map((f, idx) =>
            idx === prev.length - totalInBatch + queueIdx
              ? { ...f, status: "error", error: errMsg }
              : f
          )
        );
        if (currentFileId) {
          const existing = getFileById(currentFileId);
          if (existing)
            saveFile({ ...existing, parseStatus: "error", parseError: errMsg });
        }
        return null;
      }
    },
    [clientId, batchId]
  );

  // ── Excel processing (called after mapping confirmed) ──────────────────
  const processExcelWithMapping = useCallback(
    async (
      file: File,
      arrayBuffer: ArrayBuffer,
      mapping: ColumnMapping
    ): Promise<UploadedFile | null> => {
      let currentFileId = "";
      try {
        const fileId = nanoid();
        currentFileId = fileId;
        const dataKey = `${clientId}_${fileId}`;

        const uploadedFile: UploadedFile = {
          id: fileId,
          clientId,
          batchId,
          name: file.name,
          type: "excel",
          sizeBytes: file.size,
          parseStatus: "parsing",
          uploadedAt: new Date().toISOString(),
          dataKey,
        };
        saveFile(uploadedFile);

        const result = await parseExcelFileWithMapping(
          arrayBuffer,
          mapping,
          fileId,
          clientId,
          batchId
        );

        const rowsWithIds = result.rows.map((r) => ({ ...r, id: nanoid() }));
        saveExcelRows(rowsWithIds);

        const updated: UploadedFile = {
          ...uploadedFile,
          parseStatus: "parsed",
          parsedRowCount: result.rows.length,
          parseWarnings: result.warnings.length > 0 ? result.warnings : undefined,
        };
        saveFile(updated);
        return updated;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (currentFileId) {
          const existing = getFileById(currentFileId);
          if (existing)
            saveFile({ ...existing, parseStatus: "error", parseError: errMsg });
        }
        return null;
      }
    },
    [clientId, batchId]
  );

  // ── Main drop / file-select handler ────────────────────────────────────
  const handleFiles = useCallback(
    async (rawFiles: FileList | File[]) => {
      const files = Array.from(rawFiles);
      const valid: PendingFile[] = [];
      const excelQueue: { file: File; arrayBuffer: ArrayBuffer }[] = [];

      for (const file of files) {
        const type = detectFileType(file);
        if (!type) continue;
        valid.push({ file, type, status: "pending" });
      }

      if (valid.length === 0) return;

      setPendingFiles((prev) => [...prev, ...valid]);
      setIsProcessing(true);

      const uploaded: UploadedFile[] = [];

      // Process DXFs immediately; collect Excel files for the mapping dialog
      for (let i = 0; i < valid.length; i++) {
        const item = valid[i];

        setPendingFiles((prev) =>
          prev.map((f, idx) =>
            idx === prev.length - valid.length + i
              ? { ...f, status: "parsing" }
              : f
          )
        );

        if (item.type === "dxf") {
          const result = await processDxfFile(item.file, i, valid.length);
          if (result) uploaded.push(result);
        } else {
          // Read headers for the mapping dialog, then queue
          try {
            const arrayBuffer = await item.file.arrayBuffer();
            const headersResult = readExcelHeaders(arrayBuffer);
            excelQueue.push({ file: item.file, arrayBuffer });

            // Mark as "pending" in queue (not done yet — waiting for user)
            setPendingFiles((prev) =>
              prev.map((f, idx) =>
                idx === prev.length - valid.length + i
                  ? { ...f, status: "pending" }
                  : f
              )
            );

            // Open mapping dialog — push to queue (dialogs shown one at a time)
            setMappingQueue((prev) => [
              ...prev,
              { file: item.file, arrayBuffer, headersResult },
            ]);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            setPendingFiles((prev) =>
              prev.map((f, idx) =>
                idx === prev.length - valid.length + i
                  ? { ...f, status: "error", error: errMsg }
                  : f
              )
            );
          }
        }
      }

      setIsProcessing(false);
      if (uploaded.length > 0) onFilesUploaded?.(uploaded);

      // Clear DXF done items after 3s
      setTimeout(() => {
        setPendingFiles((prev) => prev.filter((f) => f.status !== "done"));
      }, 3000);
    },
    [clientId, batchId, processDxfFile, onFilesUploaded]
  );

  // ── Mapping dialog callbacks ────────────────────────────────────────────
  const handleMappingConfirm = useCallback(
    async (mapping: ColumnMapping) => {
      if (!currentMapping) return;

      // Show "parsing" in queue for this file
      setPendingFiles((prev) =>
        prev.map((f) =>
          f.file === currentMapping.file && f.status === "pending"
            ? { ...f, status: "parsing" }
            : f
        )
      );

      const result = await processExcelWithMapping(
        currentMapping.file,
        currentMapping.arrayBuffer,
        mapping
      );

      setPendingFiles((prev) =>
        prev.map((f) =>
          f.file === currentMapping.file && f.status === "parsing"
            ? { ...f, status: result ? "done" : "error" }
            : f
        )
      );

      // Remove from queue — next Excel in queue (if any) will show automatically
      setMappingQueue((prev) => prev.slice(1));

      if (result) {
        onFilesUploaded?.([result]);
        setTimeout(() => {
          setPendingFiles((prev) => prev.filter((f) => f.status !== "done"));
        }, 3000);
      }
    },
    [currentMapping, processExcelWithMapping, onFilesUploaded]
  );

  const handleMappingCancel = useCallback(() => {
    if (!currentMapping) return;
    // Remove the file row from the pending list
    setPendingFiles((prev) =>
      prev.filter((f) => f.file !== currentMapping.file)
    );
    setMappingQueue((prev) => prev.slice(1));
  }, [currentMapping]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <>
      {/* ── Column mapping dialog ─────────────────────────────────────── */}
      {currentMapping && (
        <ColumnMappingDialog
          open={true}
          fileName={currentMapping.file.name}
          headersResult={currentMapping.headersResult}
          onConfirm={handleMappingConfirm}
          onCancel={handleMappingCancel}
        />
      )}

      <div className="space-y-3">
        {/* ── Drop zone ─────────────────────────────────────────────────── */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".dxf,.xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Drop files here or{" "}
                <span className="text-primary underline underline-offset-2">
                  browse
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                DXF files and Excel files (.xlsx, .xls, .csv)
              </p>
            </div>
          </div>
        </div>

        {/* ── Processing queue ───────────────────────────────────────────── */}
        {pendingFiles.length > 0 && (
          <div className="space-y-1.5">
            {pendingFiles.map((item, i) => (
              <div key={i} className="space-y-1">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                    item.status === "error"
                      ? "bg-red-50 border border-red-200"
                      : item.status === "pending" && item.type === "excel"
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-muted/50"
                  )}
                >
                  <FileTypeBadge type={item.type} />
                  <span className="flex-1 truncate text-foreground font-medium">
                    {item.file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(item.file.size / 1024).toFixed(0)} KB
                  </span>

                  {item.status === "parsing" && (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  )}
                  {item.status === "pending" && item.type === "excel" && (
                    <span className="text-xs text-blue-600 font-medium shrink-0">
                      Waiting for mapping…
                    </span>
                  )}
                  {item.status === "done" && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  {item.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                </div>
                {item.status === "error" && item.error && (
                  <p className="px-3 text-xs text-red-600">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
