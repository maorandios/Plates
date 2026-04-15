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
import { formatInteger } from "@/lib/formatNumbers";
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
  /** Called after files are saved so the parent can refresh the file list. Args optional. */
  onFilesUploaded?: (uploaded?: UploadedFile[]) => void;
}

interface PendingFile {
  /** Stable key — never use list index after async (indices shift when other uploads finish). */
  localId: string;
  file: File;
  type: FileType;
  status: "pending" | "parsing" | "done" | "error";
  error?: string;
}

/** Queued Excel file waiting for the user to confirm column mapping */
interface PendingExcelMapping {
  localId: string;
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

  const [mappingQueue, setMappingQueue] = useState<PendingExcelMapping[]>([]);
  const currentMapping = mappingQueue[0] ?? null;

  const processDxfFile = useCallback(
    async (file: File, localId: string): Promise<UploadedFile | null> => {
      let currentFileId = "";
      try {
        if (!clientId || !batchId) {
          throw new Error("Missing client or batch — refresh the page and try again.");
        }

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

        const u = result.unitDetection;
        const updated: UploadedFile = {
          ...uploadedFile,
          parseStatus: "parsed",
          parsedRowCount: result.geometry.entityCount,
          parseWarnings: result.warnings.length > 0 ? result.warnings : undefined,
          detectedUnit: u.detectedUnit,
          detectedUnitLabel: u.displayLabel,
          detectedUnitSource: u.source,
        };
        saveFile(updated);

        setPendingFiles((prev) =>
          prev.map((f) => (f.localId === localId ? { ...f, status: "done" } : f))
        );

        return updated;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.localId === localId ? { ...f, status: "error", error: errMsg } : f
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

  const processExcelWithMapping = useCallback(
    async (
      file: File,
      arrayBuffer: ArrayBuffer,
      mapping: ColumnMapping
    ): Promise<UploadedFile | null> => {
      let currentFileId = "";
      try {
        if (!clientId || !batchId) {
          throw new Error("Missing client or batch — refresh the page and try again.");
        }

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

  const handleFiles = useCallback(
    async (rawFiles: FileList | File[]) => {
      const files = Array.from(rawFiles);
      const newItems: PendingFile[] = [];

      for (const file of files) {
        const type = detectFileType(file);
        if (!type) continue;
        newItems.push({
          localId: nanoid(),
          file,
          type,
          status: "pending",
        });
      }

      if (newItems.length === 0) return;

      setPendingFiles((prev) => [...prev, ...newItems]);

      const uploaded: UploadedFile[] = [];

      for (const item of newItems) {
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.localId === item.localId ? { ...f, status: "parsing" } : f
          )
        );

        if (item.type === "dxf") {
          const result = await processDxfFile(item.file, item.localId);
          if (result) uploaded.push(result);
        } else {
          try {
            const arrayBuffer = await item.file.arrayBuffer();
            const headersResult = readExcelHeaders(arrayBuffer);

            setPendingFiles((prev) =>
              prev.map((f) =>
                f.localId === item.localId ? { ...f, status: "pending" } : f
              )
            );

            setMappingQueue((prev) => [
              ...prev,
              {
                localId: item.localId,
                file: item.file,
                arrayBuffer,
                headersResult,
              },
            ]);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            setPendingFiles((prev) =>
              prev.map((f) =>
                f.localId === item.localId
                  ? { ...f, status: "error", error: errMsg }
                  : f
              )
            );
          }
        }
      }

      if (uploaded.length > 0) onFilesUploaded?.(uploaded);
    },
    [processDxfFile, onFilesUploaded]
  );

  const handleMappingConfirm = useCallback(
    async (mapping: ColumnMapping) => {
      if (!currentMapping) return;

      const { localId, file, arrayBuffer } = currentMapping;

      setPendingFiles((prev) =>
        prev.map((f) =>
          f.localId === localId ? { ...f, status: "parsing" } : f
        )
      );

      const result = await processExcelWithMapping(file, arrayBuffer, mapping);

      setPendingFiles((prev) =>
        prev.map((f) =>
          f.localId === localId
            ? {
                ...f,
                status: result ? "done" : "error",
                error: result ? undefined : "Excel import failed — check mapping and file format.",
              }
            : f
        )
      );

      setMappingQueue((prev) => prev.slice(1));

      // Always refresh parent file list (DXF + Excel live in the store; list was easy to miss after dialog closed).
      onFilesUploaded?.(result ? [result] : undefined);
    },
    [currentMapping, processExcelWithMapping, onFilesUploaded]
  );

  const handleMappingCancel = useCallback(() => {
    if (!currentMapping) return;
    const { localId } = currentMapping;
    setPendingFiles((prev) => prev.filter((f) => f.localId !== localId));
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

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (list?.length) handleFiles(list);
      e.target.value = "";
    },
    [handleFiles]
  );

  return (
    <>
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
        <div
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
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
            onChange={onInputChange}
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

        {pendingFiles.length > 0 && (
          <div className="space-y-1.5">
            {pendingFiles.map((item) => (
              <div key={item.localId} className="space-y-1">
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
                    {formatInteger(Math.round(item.file.size / 1024))} KB
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
                    <CheckCircle2 className="h-4 w-4 text-primary" />
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
