"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FileTypeBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  saveFile,
  saveFileData,
  saveExcelRows,
  saveDxfGeometry,
  getFileById,
  getFilesByClient,
} from "@/lib/store";
import { nanoid } from "@/lib/utils/nanoid";
import {
  readExcelHeaders,
  parseExcelFileWithMapping,
  type ExcelHeadersResult,
} from "@/lib/parsers/excelParser";
import { parseDxfFile } from "@/lib/parsers/dxfParser";
import { ColumnMappingDialog } from "./ColumnMappingDialog";
import { ClientDxfTable } from "./ClientDxfTable";
import type { ColumnMapping, UploadedFile, FileType } from "@/types";

type WizardStep = "dxf" | "excel" | "summary" | "table";

interface PendingRow {
  localId: string;
  file: File;
  type: FileType;
  status: "pending" | "parsing" | "done" | "error";
  error?: string;
}

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

const STEP_LABELS: { key: WizardStep; label: string }[] = [
  { key: "dxf", label: "DXF" },
  { key: "excel", label: "Excel" },
  { key: "summary", label: "Review" },
  { key: "table", label: "Files" },
];

interface ClientImportWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  batchId: string;
  onFinished?: () => void;
}

export function ClientImportWizardModal({
  open,
  onOpenChange,
  clientId,
  batchId,
  onFinished,
}: ClientImportWizardModalProps) {
  const [step, setStep] = useState<WizardStep>("dxf");
  const [sessionUploadIds, setSessionUploadIds] = useState<string[]>([]);
  const [pendingDxf, setPendingDxf] = useState<PendingRow[]>([]);
  const [pendingExcel, setPendingExcel] = useState<PendingRow[]>([]);
  const [mappingQueue, setMappingQueue] = useState<PendingExcelMapping[]>([]);
  const [tableRefresh, setTableRefresh] = useState(0);

  const dxfInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const currentMapping = mappingQueue[0] ?? null;

  const resetWizard = useCallback(() => {
    setStep("dxf");
    setSessionUploadIds([]);
    setPendingDxf([]);
    setPendingExcel([]);
    setMappingQueue([]);
  }, []);

  useEffect(() => {
    if (open) {
      resetWizard();
    }
  }, [open, resetWizard]);

  const processDxfFile = useCallback(
    async (file: File, localId: string): Promise<UploadedFile | null> => {
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
        setPendingDxf((prev) =>
          prev.map((f) => (f.localId === localId ? { ...f, status: "done" } : f))
        );
        setSessionUploadIds((prev) => [...prev, fileId]);
        return updated;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setPendingDxf((prev) =>
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
        setSessionUploadIds((prev) => [...prev, fileId]);
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

  const handleDxfFiles = useCallback(
    async (list: FileList | File[]) => {
      const files = Array.from(list).filter((f) => detectFileType(f) === "dxf");
      if (files.length === 0) return;
      const newRows: PendingRow[] = files.map((file) => ({
        localId: nanoid(),
        file,
        type: "dxf" as const,
        status: "pending",
      }));
      setPendingDxf((prev) => [...prev, ...newRows]);
      for (const item of newRows) {
        setPendingDxf((prev) =>
          prev.map((f) =>
            f.localId === item.localId ? { ...f, status: "parsing" } : f
          )
        );
        await processDxfFile(item.file, item.localId);
      }
    },
    [processDxfFile]
  );

  const handleExcelFiles = useCallback(async (list: FileList | File[]) => {
    const files = Array.from(list).filter((f) => detectFileType(f) === "excel");
    if (files.length === 0) return;
    const newRows: PendingRow[] = files.map((file) => ({
      localId: nanoid(),
      file,
      type: "excel" as const,
      status: "pending",
    }));
    setPendingExcel((prev) => [...prev, ...newRows]);
    for (const item of newRows) {
      try {
        const arrayBuffer = await item.file.arrayBuffer();
        const headersResult = readExcelHeaders(arrayBuffer);
        setPendingExcel((prev) =>
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
        setPendingExcel((prev) =>
          prev.map((f) =>
            f.localId === item.localId
              ? { ...f, status: "error", error: errMsg }
              : f
          )
        );
      }
    }
  }, []);

  const handleMappingConfirm = useCallback(
    async (mapping: ColumnMapping) => {
      if (!currentMapping) return;
      const { localId, file, arrayBuffer } = currentMapping;
      setPendingExcel((prev) =>
        prev.map((f) =>
          f.localId === localId ? { ...f, status: "parsing" } : f
        )
      );
      const result = await processExcelWithMapping(file, arrayBuffer, mapping);
      setPendingExcel((prev) =>
        prev.map((f) =>
          f.localId === localId
            ? {
                ...f,
                status: result ? "done" : "error",
                error: result ? undefined : "Excel import failed.",
              }
            : f
        )
      );
      setMappingQueue((prev) => prev.slice(1));
    },
    [currentMapping, processExcelWithMapping]
  );

  const handleMappingCancel = useCallback(() => {
    if (!currentMapping) return;
    const { localId } = currentMapping;
    setPendingExcel((prev) => prev.filter((f) => f.localId !== localId));
    setMappingQueue((prev) => prev.slice(1));
  }, [currentMapping]);

  const dxfParsing = pendingDxf.some((p) => p.status === "parsing");
  const dxfCanNext =
    pendingDxf.length > 0 && !dxfParsing && !currentMapping;

  const excelParsing = pendingExcel.some((p) => p.status === "parsing");
  const excelWaitingMap = pendingExcel.some(
    (p) => p.type === "excel" && p.status === "pending"
  );
  const excelCanNext =
    !currentMapping && !excelParsing && !excelWaitingMap;

  const summaryFiles = sessionUploadIds
    .map((id) => getFileById(id))
    .filter(Boolean) as UploadedFile[];

  const stepIndex = STEP_LABELS.findIndex((s) => s.key === step);

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

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            resetWizard();
            onOpenChange(false);
          } else {
            onOpenChange(true);
          }
        }}
      >
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto",
            step === "table" ? "max-w-4xl" : "max-w-lg"
          )}
        >
          <DialogHeader>
            <DialogTitle>Import files</DialogTitle>
            <DialogDescription>
              Step-by-step: DXF drawings, then Excel lists. You can close anytime; completed
              uploads stay saved.
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground pb-2 border-b border-border">
            {STEP_LABELS.map((s, i) => (
              <span key={s.key} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-md font-medium",
                    step === s.key
                      ? "bg-primary text-primary-foreground"
                      : i < stepIndex
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  {i + 1}. {s.label}
                </span>
              </span>
            ))}
          </div>

          {step === "dxf" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-foreground">
                Upload one or more DXF files. Wait until parsing finishes for each file.
              </p>
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                  "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                )}
                onClick={() => dxfInputRef.current?.click()}
              >
                <input
                  ref={dxfInputRef}
                  type="file"
                  multiple
                  accept=".dxf"
                  className="hidden"
                  onChange={(e) => {
                    const l = e.target.files;
                    if (l?.length) handleDxfFiles(l);
                    e.target.value = "";
                  }}
                />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop DXF here or browse</p>
              </div>

              {pendingDxf.length > 0 && (
                <div className="space-y-2">
                  {pendingDxf.map((row) => (
                    <div
                      key={row.localId}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border",
                        row.status === "error"
                          ? "bg-red-50 border-red-200"
                          : "bg-muted/40 border-border"
                      )}
                    >
                      <FileTypeBadge type="dxf" />
                      <span className="flex-1 truncate">{row.file.name}</span>
                      {row.status === "parsing" && (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      )}
                      {row.status === "done" && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                      {row.status === "error" && (
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {pendingDxf.length > 0 && !dxfParsing && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-900">
                  <strong>Parse complete.</strong>{" "}
                  {pendingDxf.filter((p) => p.status === "done").length} DXF file
                  {pendingDxf.filter((p) => p.status === "done").length !== 1
                    ? "s"
                    : ""}{" "}
                  parsed successfully
                  {pendingDxf.some((p) => p.status === "error") && (
                    <span className="text-red-700">
                      {" "}
                      · {pendingDxf.filter((p) => p.status === "error").length} error(s)
                    </span>
                  )}
                  .
                </div>
              )}
            </div>
          )}

          {step === "excel" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-foreground">
                Upload Excel files (.xlsx, .xls, .csv). Map columns when prompted.
              </p>
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                  "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                )}
                onClick={() => excelInputRef.current?.click()}
              >
                <input
                  ref={excelInputRef}
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const l = e.target.files;
                    if (l?.length) handleExcelFiles(l);
                    e.target.value = "";
                  }}
                />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop Excel here or browse</p>
              </div>

              {pendingExcel.length > 0 && (
                <div className="space-y-2">
                  {pendingExcel.map((row) => (
                    <div
                      key={row.localId}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border",
                        row.status === "error"
                          ? "bg-red-50 border-red-200"
                          : "bg-muted/40 border-border"
                      )}
                    >
                      <FileTypeBadge type="excel" />
                      <span className="flex-1 truncate">{row.file.name}</span>
                      {row.status === "parsing" && (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      )}
                      {row.status === "pending" && (
                        <span className="text-xs text-blue-600">Mapping…</span>
                      )}
                      {row.status === "done" && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                      {row.status === "error" && (
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {step === "summary" && (
            <div className="space-y-3 py-2 text-sm">
              <p className="font-medium text-foreground">Import summary</p>
              {summaryFiles.length === 0 ? (
                <p className="text-muted-foreground">No files in this session.</p>
              ) : (
                <ul className="space-y-2 border rounded-lg divide-y border-border bg-muted/20">
                  {summaryFiles.map((f) => (
                    <li key={f.id} className="px-3 py-2 flex flex-col gap-0.5">
                      <span className="font-medium truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {f.type.toUpperCase()} · {f.parseStatus}
                        {f.parsedRowCount != null &&
                          f.type === "excel" &&
                          ` · ${f.parsedRowCount} rows`}
                        {f.type === "dxf" &&
                          f.parsedRowCount != null &&
                          ` · ${f.parsedRowCount} entities`}
                      </span>
                      {f.parseStatus === "error" && f.parseError && (
                        <span className="text-xs text-red-600">{f.parseError}</span>
                      )}
                      {f.parseWarnings?.map((w, i) => (
                        <span key={i} className="text-xs text-amber-700">
                          {w}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === "table" && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                DXF files for this client (all uploads, not only this session).
              </p>
              <ClientDxfTable
                key={tableRefresh}
                files={getFilesByClient(clientId)}
                onFileDeleted={() => setTableRefresh((k) => k + 1)}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            {step === "dxf" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetWizard();
                    onOpenChange(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep("excel")}
                  disabled={!dxfCanNext}
                >
                  Next
                </Button>
              </>
            )}
            {step === "excel" && (
              <>
                <Button type="button" variant="outline" onClick={() => setStep("dxf")}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep("summary")}
                  disabled={!excelCanNext}
                >
                  Next
                </Button>
              </>
            )}
            {step === "summary" && (
              <>
                <Button type="button" variant="outline" onClick={() => setStep("excel")}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button type="button" onClick={() => { setStep("table"); setTableRefresh((k) => k + 1); }}>
                  Complete
                </Button>
              </>
            )}
            {step === "table" && (
              <Button
                type="button"
                onClick={() => {
                  onFinished?.();
                  resetWizard();
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
