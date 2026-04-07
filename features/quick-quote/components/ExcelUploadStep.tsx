"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Check,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MaterialType } from "@/types/materials";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { MethodPhaseMetricStrip } from "./method-phases/MethodPhaseMetricStrip";
import { readExcelHeaders, parseExcelFileWithMapping } from "@/lib/parsers/excelParser";
import type { ColumnMapping, ExcelRow } from "@/types";
import type { ExcelHeadersResult } from "@/lib/parsers/excelParser";
import {
  DEFAULT_PLATE_FINISH,
  PLATE_FINISH_OPTIONS,
  type PlateFinish,
} from "../lib/plateFields";
import type { ManualQuotePartRow } from "../types/quickQuote";
import {
  excelRowsToManualQuoteRows,
  getManualQuoteValidationLines,
  manualQuoteRowsToRestoredExcelRows,
} from "../lib/manualQuoteParts";

const NONE = "__none__";

export type ExcelUploadStepVariant = "dxf" | "quoteImport";

interface ExcelUploadStepProps {
  onDataApproved: (data: ExcelRow[]) => void;
  variant?: ExcelUploadStepVariant;
  /** Quote import: sync parent whenever review rows change (step 3). */
  onQuoteImportRowsChange?: (data: ExcelRow[]) => void;
  /** Quote import: material density from General — used for estimated total weight. */
  quoteImportDensityKgPerM3?: number;
  /** Quote import: plate family label from General (split sidebar). */
  quoteImportPlateTypeLabel?: string;
  /** Quote import: validates Complete against manual-quote rules. */
  quoteImportMaterialType?: MaterialType;
  onPhaseBack?: () => void;
  onPhaseComplete?: () => void;
  /** Saved quote lines — reopening Import Excel list starts at review with this data. */
  quoteImportRestoredRows?: ManualQuotePartRow[];
}

interface ExcelMetrics {
  totalPlates: number;
  uniqueThicknesses: number[];
  totalWeight: number;
  materialTypes: string[];
}

interface MappingField {
  key: keyof Omit<ColumnMapping, "headerRowIdx">;
  label: string;
  required: boolean;
  description: string;
}

const MAPPING_FIELDS: MappingField[] = [
  { key: "partNameCol", label: "Part Name", required: true, description: "Unique identifier for each part" },
  { key: "qtyCol", label: "Quantity", required: false, description: "Number of pieces (defaults to 1)" },
  { key: "thkCol", label: "Thickness", required: false, description: "Plate thickness in mm" },
  { key: "matCol", label: "Material", required: false, description: "Steel grade or material type" },
  { key: "lengthCol", label: "Length", required: false, description: "Plate length in mm" },
  { key: "widthCol", label: "Width", required: false, description: "Plate width in mm" },
  { key: "weightCol", label: "Weight", required: false, description: "Unit weight per piece in kg" },
];

/** Column mapping for quote-from-list (no DXF / weight columns). */
const QUOTE_IMPORT_MAPPING_FIELDS: MappingField[] = [
  { key: "partNameCol", label: "Part number", required: true, description: "Unique identifier for each line" },
  { key: "thkCol", label: "Thickness (mm)", required: false, description: "Plate thickness in mm" },
  { key: "qtyCol", label: "Quantity", required: false, description: "Number of pieces (defaults to 1)" },
  { key: "widthCol", label: "Width (mm)", required: false, description: "Plate width in mm" },
  { key: "lengthCol", label: "Length (mm)", required: false, description: "Plate length in mm" },
  { key: "matCol", label: "Material grade", required: false, description: "Steel grade or designation" },
  { key: "finishCol", label: "Finish", required: false, description: "Surface finish (carbon, galvanized, paint)" },
];

type ExcelSubStep = 1 | 2 | 3;

const SUB_STEPS = [
  { step: 1 as ExcelSubStep, label: "Upload Excel" },
  { step: 2 as ExcelSubStep, label: "Map Columns" },
  { step: 3 as ExcelSubStep, label: "Review Data" },
];

function parseCellNumber(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function finishStringToPlateFinish(s: string | undefined): PlateFinish {
  const v = (s ?? "").trim().toLowerCase();
  if (v === "galvanized" || v === "paint" || v === "carbon") return v;
  if (v.includes("galvan")) return "galvanized";
  if (v.includes("paint")) return "paint";
  return DEFAULT_PLATE_FINISH;
}

const QUOTE_IMPORT_PHASE_VIEWPORT =
  "flex h-full min-h-0 max-h-full flex-col overflow-hidden";

export function ExcelUploadStep({
  onDataApproved,
  variant = "dxf",
  onQuoteImportRowsChange,
  quoteImportDensityKgPerM3,
  quoteImportPlateTypeLabel,
  quoteImportMaterialType,
  onPhaseBack,
  onPhaseComplete,
  quoteImportRestoredRows,
}: ExcelUploadStepProps) {
  const [subStep, setSubStep] = useState<ExcelSubStep>(() => {
    if (
      variant === "quoteImport" &&
      quoteImportRestoredRows &&
      quoteImportRestoredRows.length > 0
    ) {
      return 3;
    }
    return 1;
  });
  const [file, setFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [headersResult, setHeadersResult] = useState<ExcelHeadersResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [parsedRows, setParsedRows] = useState<ExcelRow[] | null>(() => {
    if (
      variant === "quoteImport" &&
      quoteImportRestoredRows &&
      quoteImportRestoredRows.length > 0
    ) {
      return manualQuoteRowsToRestoredExcelRows(quoteImportRestoredRows);
    }
    return null;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [phaseBackConfirmOpen, setPhaseBackConfirmOpen] = useState(false);
  const [phaseCompleteDialogOpen, setPhaseCompleteDialogOpen] = useState(false);
  const [phaseCompleteLines, setPhaseCompleteLines] = useState<string[]>([]);

  const activeMappingFields = useMemo(
    () => (variant === "quoteImport" ? QUOTE_IMPORT_MAPPING_FIELDS : MAPPING_FIELDS),
    [variant]
  );

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setUploadError(null);
    setParseError(null);
    setFile(selectedFile);
    setParsedRows(null);
    if (variant === "quoteImport" && onQuoteImportRowsChange) {
      onQuoteImportRowsChange([]);
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      setArrayBuffer(buffer);

      const headers = readExcelHeaders(buffer);
      setHeadersResult(headers);
      setMapping(headers.autoDetected);

      setSubStep(2);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to read Excel file"
      );
      setFile(null);
      setArrayBuffer(null);
    }
  }, [variant, onQuoteImportRowsChange]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setArrayBuffer(null);
    setHeadersResult(null);
    setMapping(null);
    setParsedRows(null);
    setUploadError(null);
    setParseError(null);
    setSubStep(1);
    if (variant === "quoteImport" && onQuoteImportRowsChange) {
      onQuoteImportRowsChange([]);
    }
  }, [variant, onQuoteImportRowsChange]);

  const updateMapping = useCallback(
    (field: MappingField["key"], value: string) => {
      if (!mapping) return;
      setMapping({
        ...mapping,
        [field]: value === NONE ? null : parseInt(value, 10),
      });
      setParsedRows(null);
    },
    [mapping]
  );

  const resetToAutoDetected = useCallback(() => {
    if (headersResult) {
      setMapping(headersResult.autoDetected);
      setParsedRows(null);
    }
  }, [headersResult]);

  const isMappingValid = useMemo(() => {
    if (!mapping) return false;
    return mapping.partNameCol !== null;
  }, [mapping]);

  const handleParseWithMapping = useCallback(async () => {
    if (!arrayBuffer || !mapping || !file) return;

    setParseError(null);
    try {
      const result = await parseExcelFileWithMapping(
        arrayBuffer,
        mapping,
        "temp-file-id",
        "temp-client-id",
        "temp-batch-id"
      );

      if (result.rows.length === 0) {
        setParseError("No valid rows found with current mapping. Please adjust the column mapping.");
        return;
      }

      const rowsWithIds: ExcelRow[] = result.rows.map((row, index) => ({
        ...row,
        id: `excel-row-${index}`,
      }));

      setParsedRows(rowsWithIds);
      setSubStep(3);
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Failed to parse Excel file"
      );
    }
  }, [arrayBuffer, mapping, file]);

  const handleBackToMapping = useCallback(() => {
    setSubStep(2);
    setParsedRows(null);
    if (variant === "quoteImport" && onQuoteImportRowsChange) {
      onQuoteImportRowsChange([]);
    }
  }, [variant, onQuoteImportRowsChange]);

  const handleQuotePhaseBack = useCallback(() => {
    if (variant !== "quoteImport" || !onPhaseBack) return;
    if (subStep === 1 && !file) {
      onQuoteImportRowsChange?.([]);
      onPhaseBack();
      return;
    }
    setPhaseBackConfirmOpen(true);
  }, [variant, onPhaseBack, onQuoteImportRowsChange, subStep, file]);

  const confirmQuotePhaseBack = useCallback(() => {
    handleRemoveFile();
    setPhaseBackConfirmOpen(false);
    onPhaseBack?.();
  }, [handleRemoveFile, onPhaseBack]);

  const handleQuotePhaseComplete = useCallback(() => {
    if (variant !== "quoteImport" || !onPhaseComplete || !quoteImportMaterialType) return;
    if (subStep !== 3 || !parsedRows?.length) {
      setPhaseCompleteLines([
        "Finish upload, column mapping, and review so at least one row is in the table before completing.",
      ]);
      setPhaseCompleteDialogOpen(true);
      return;
    }
    const manualRows = excelRowsToManualQuoteRows(parsedRows, quoteImportMaterialType);
    const lines = getManualQuoteValidationLines(manualRows);
    if (lines) {
      setPhaseCompleteLines(lines);
      setPhaseCompleteDialogOpen(true);
      return;
    }
    onPhaseComplete();
  }, [variant, onPhaseComplete, quoteImportMaterialType, subStep, parsedRows]);

  const patchParsedRow = useCallback((id: string, patch: Partial<ExcelRow>) => {
    setParsedRows((prev) =>
      prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : null
    );
  }, []);

  const deleteParsedRow = useCallback((id: string) => {
    setParsedRows((prev) => (prev ? prev.filter((r) => r.id !== id) : null));
  }, []);

  const metrics = useMemo((): ExcelMetrics | null => {
    if (!parsedRows) return null;

    const thicknessSet = new Set<number>();
    const materialSet = new Set<string>();
    let totalWeight = 0;

    parsedRows.forEach((row) => {
      if (row.thickness) thicknessSet.add(row.thickness);
      if (row.material) materialSet.add(row.material);
      if (row.totalWeight) {
        totalWeight += row.totalWeight;
      } else if (row.weight) {
        totalWeight += row.weight * row.quantity;
      }
    });

    return {
      totalPlates: parsedRows.reduce((sum, r) => sum + r.quantity, 0),
      uniqueThicknesses: Array.from(thicknessSet).sort((a, b) => a - b),
      totalWeight,
      materialTypes: Array.from(materialSet),
    };
  }, [parsedRows]);

  const quoteImportMetrics = useMemo(() => {
    if (!parsedRows) return null;
    const rho =
      quoteImportDensityKgPerM3 != null &&
      Number.isFinite(quoteImportDensityKgPerM3) &&
      quoteImportDensityKgPerM3 > 0
        ? quoteImportDensityKgPerM3
        : 7850;
    let totalQty = 0;
    let totalAreaM2 = 0;
    let totalWeightKg = 0;
    for (const r of parsedRows) {
      const q = Math.max(0, Math.floor(r.quantity) || 0);
      const w = Math.max(0, r.width ?? 0);
      const l = Math.max(0, r.length ?? 0);
      const th = Math.max(0, Number(r.thickness) || 0);
      totalQty += q;
      const pieceAreaM2 = (w * l) / 1_000_000;
      totalAreaM2 += pieceAreaM2 * q;
      const tM = th / 1000;
      totalWeightKg += pieceAreaM2 * tM * q * rho;
    }
    return {
      plateLines: parsedRows.length,
      totalQty,
      totalAreaM2,
      totalWeightKg,
    };
  }, [parsedRows, quoteImportDensityKgPerM3]);

  useEffect(() => {
    if (variant !== "quoteImport" || subStep !== 3 || !onQuoteImportRowsChange) return;
    onQuoteImportRowsChange(parsedRows ?? []);
  }, [variant, subStep, parsedRows, onQuoteImportRowsChange]);

  const handleContinueToNextPhase = useCallback(() => {
    if (parsedRows) {
      onDataApproved(parsedRows);
    }
  }, [parsedRows, onDataApproved]);

  const previewData = useMemo(() => {
    if (!headersResult || !mapping) return null;

    return headersResult.previewRows.slice(0, 3).map((row, rowIndex) => {
      const cells: { label: string; value: string }[] = [];

      activeMappingFields.forEach((field) => {
        const colIdx = mapping[field.key];
        const value =
          colIdx !== null && colIdx !== undefined
            ? String(row[colIdx] ?? "-")
            : "-";
        cells.push({ label: field.label, value });
      });

      return { rowIndex, cells };
    });
  }, [headersResult, mapping, activeMappingFields]);

  const showDxfReview = variant === "dxf" && parsedRows && metrics;
  const showQuoteReview = variant === "quoteImport" && parsedRows && quoteImportMetrics;

  const uploadInputId =
    variant === "quoteImport" ? "excel-upload-quote-import" : "excel-upload";

  const quoteImportRightHeader = useMemo(() => {
    if (variant !== "quoteImport") return { title: "", desc: "" };
    switch (subStep) {
      case 1:
        return {
          title: "Upload spreadsheet",
          desc: "Drop an Excel or CSV file, or browse. Column mapping follows on the next step.",
        };
      case 2:
        return {
          title: "Map columns",
          desc: "Match each field to a workbook column. Part number is required.",
        };
      case 3:
        return {
          title: "Review data",
          desc: "Edit values or remove lines. Tables below stay in sync with the summary on the left.",
        };
      default:
        return { title: "", desc: "" };
    }
  }, [variant, subStep]);

  const mainColumn = (
    <div className={cn(variant === "quoteImport" ? "space-y-4" : "space-y-6")}>
      <Card className="border-0">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            {SUB_STEPS.map(({ step, label }, index) => {
              const isComplete = step < subStep;
              const isCurrent = step === subStep;

              return (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                        isComplete && "border-emerald-600 bg-emerald-600 text-white",
                        isCurrent && !isComplete && "border-primary bg-primary text-primary-foreground",
                        !isCurrent && !isComplete && "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                      )}
                    >
                      {isComplete ? <Check className="h-4 w-4" /> : step}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium whitespace-nowrap",
                        isCurrent && "text-foreground",
                        !isCurrent && isComplete && "text-emerald-600",
                        !isCurrent && !isComplete && "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  {index < SUB_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1 mx-3",
                        step < subStep ? "bg-emerald-600" : "bg-border"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {subStep === 1 && (
        <Card>
          {variant !== "quoteImport" ? (
            <CardHeader>
              <CardTitle>Upload Excel/CSV</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your bill of materials with part details
              </p>
            </CardHeader>
          ) : null}
          <CardContent className={variant === "quoteImport" ? "pt-6" : undefined}>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Drag and drop your Excel or CSV file here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse
                  </p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id={uploadInputId}
                />
                <Button asChild variant="outline">
                  <label htmlFor={uploadInputId} className="cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Choose File
                  </label>
                </Button>
              </div>
            </div>
            {uploadError && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{uploadError}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {subStep === 2 && file && headersResult && mapping && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>File Uploaded</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Verify the column mapping below
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {headersResult.previewRows.length} rows detected
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {headersResult.sheetName}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Column Mapping</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Map your Excel columns to the required fields
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToAutoDetected}
                  className="gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset to Auto-detected
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {previewData && (
                <div className="space-y-2">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          {activeMappingFields.map((field) => {
                            const currentValue = mapping[field.key];
                            const valueStr =
                              currentValue !== null && currentValue !== undefined
                                ? String(currentValue)
                                : NONE;

                            return (
                              <TableHead key={field.key} className="p-2 min-w-[140px]">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold">
                                      {field.label}
                                    </span>
                                    {field.required && (
                                      <span className="text-destructive text-xs">*</span>
                                    )}
                                  </div>
                                  <Select
                                    value={valueStr}
                                    onValueChange={(v) => updateMapping(field.key, v)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={NONE}>
                                        <span className="text-muted-foreground text-xs">None</span>
                                      </SelectItem>
                                      {headersResult.rawHeaders
                                        .filter((h) => h && h.trim())
                                        .map((header, index) => (
                                          <SelectItem key={`${header}-${index}`} value={String(index)}>
                                            <span className="text-xs">{header}</span>
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-[10px] text-muted-foreground leading-tight">
                                    {field.description}
                                  </p>
                                </div>
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row) => (
                          <TableRow key={row.rowIndex}>
                            {row.cells.map((cell, cellIndex) => (
                              <TableCell key={cellIndex} className="text-sm py-2">
                                {cell.value}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">Preview (first 3 rows)</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                {!isMappingValid && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm">Part Name is required</p>
                  </div>
                )}
                {isMappingValid && <div className="flex-1" />}
                <Button onClick={handleParseWithMapping} disabled={!isMappingValid} size="lg">
                  Continue to Review
                </Button>
              </div>

              {parseError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{parseError}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {showQuoteReview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Review and edit</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {formatInteger(parsedRows.length)} rows — adjust values or remove lines as needed.
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Part number</TableHead>
                      <TableHead className="min-w-[88px]">Thickness</TableHead>
                      <TableHead className="min-w-[72px]">Qty</TableHead>
                      <TableHead className="min-w-[88px]">Width (mm)</TableHead>
                      <TableHead className="min-w-[88px]">Length (mm)</TableHead>
                      <TableHead className="min-w-[120px]">Material grade</TableHead>
                      <TableHead className="min-w-[120px]">Finish</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row) => {
                      const finishVal = finishStringToPlateFinish(row.finish);
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Input
                              className="h-8 min-w-[100px]"
                              value={row.partName}
                              onChange={(e) =>
                                patchParsedRow(row.id, { partName: e.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-20"
                              inputMode="decimal"
                              value={
                                row.thickness != null && Number.isFinite(row.thickness)
                                  ? String(row.thickness)
                                  : ""
                              }
                              onChange={(e) => {
                                const n = parseCellNumber(e.target.value);
                                patchParsedRow(row.id, {
                                  thickness: n,
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-16"
                              inputMode="numeric"
                              value={String(row.quantity)}
                              onChange={(e) => {
                                const n = parseCellNumber(e.target.value);
                                patchParsedRow(row.id, {
                                  quantity: Math.max(1, Math.floor(n ?? 1) || 1),
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-24"
                              inputMode="decimal"
                              value={row.width != null ? String(row.width) : ""}
                              onChange={(e) => {
                                const n = parseCellNumber(e.target.value);
                                patchParsedRow(row.id, { width: n });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-24"
                              inputMode="decimal"
                              value={row.length != null ? String(row.length) : ""}
                              onChange={(e) => {
                                const n = parseCellNumber(e.target.value);
                                patchParsedRow(row.id, { length: n });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 min-w-[100px]"
                              value={row.material ?? ""}
                              onChange={(e) =>
                                patchParsedRow(row.id, { material: e.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={finishVal}
                              onValueChange={(v) =>
                                patchParsedRow(row.id, {
                                  finish: v as PlateFinish,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLATE_FINISH_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {t(`quote.finishLabels.${o.value}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => deleteParsedRow(row.id)}
                              aria-label="Delete row"
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
              <p className="text-xs text-muted-foreground mt-4">
                Use <span className="font-medium text-foreground">Complete</span> above to save the list
                and return to quote method. Use the stepper{" "}
                <span className="font-medium text-foreground">Continue</span> when you are ready for
                stock and pricing.
              </p>
            </CardContent>
          </Card>

          {file ? (
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handleBackToMapping}>
                Back to Mapping
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-2 max-w-xl">
              This table was restored from your saved quote. To change column mapping, upload a new
              file from step 1 — that replaces the list.
            </p>
          )}
        </>
      )}

      {showDxfReview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Excel Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Plate Types</p>
                  <p className="text-2xl font-semibold">{formatInteger(parsedRows.length)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Plates Quantity</p>
                  <p className="text-2xl font-semibold">{formatInteger(metrics.totalPlates)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Thicknesses</p>
                  <p className="text-2xl font-semibold">
                    {metrics.uniqueThicknesses.length
                      ? formatInteger(metrics.uniqueThicknesses.length)
                      : "-"}
                  </p>
                  {metrics.uniqueThicknesses.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {metrics.uniqueThicknesses
                        .map((t) => formatDecimal(t, t % 1 === 0 ? 0 : 2))
                        .join(", ")}{" "}
                      mm
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Weight</p>
                  <p className="text-2xl font-semibold">
                    {metrics.totalWeight > 0 ? formatDecimal(metrics.totalWeight, 2) : "-"}
                  </p>
                  {metrics.totalWeight > 0 && (
                    <p className="text-xs text-muted-foreground">kg</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Complete Excel Data</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {formatInteger(parsedRows.length)} parts ready for quotation
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Number</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Thickness</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Length (mm)</TableHead>
                      <TableHead>Width (mm)</TableHead>
                      <TableHead>Weight (kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.partName}</TableCell>
                        <TableCell>{formatInteger(row.quantity)}</TableCell>
                        <TableCell>
                          {row.thickness != null && Number.isFinite(Number(row.thickness))
                            ? formatDecimal(
                                Number(row.thickness),
                                Number(row.thickness) % 1 === 0 ? 0 : 2
                              )
                            : "-"}
                        </TableCell>
                        <TableCell>{row.material || "-"}</TableCell>
                        <TableCell>
                          {row.length ? formatDecimal(row.length, 1) : "-"}
                        </TableCell>
                        <TableCell>{row.width ? formatDecimal(row.width, 1) : "-"}</TableCell>
                        <TableCell>
                          {row.weight
                            ? formatDecimal(row.weight, 2)
                            : row.totalWeight
                              ? formatDecimal(row.totalWeight / row.quantity, 2)
                              : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleBackToMapping}>
              Back to Mapping
            </Button>
            <Button onClick={handleContinueToNextPhase} size="lg" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Continue to Next Phase
            </Button>
          </div>
        </>
      )}
    </div>
  );

  if (variant !== "quoteImport") {
    return mainColumn;
  }

  const m = quoteImportMetrics;
  const qtySidebar = m ? formatInteger(m.totalQty) : "—";
  const areaSidebar = m ? formatDecimal(m.totalAreaM2, 2) : "—";
  const wtSidebar = m ? formatDecimal(m.totalWeightKg, 1) : "—";
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-0 overflow-hidden",
        QUOTE_IMPORT_PHASE_VIEWPORT
      )}
    >
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <aside className="flex h-full min-h-0 w-full max-w-[min(420px,42vw)] shrink-0 flex-col border-r border-border/80">
          <div className="shrink-0 space-y-2 px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-snug">
              Import Excel list
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload a spreadsheet with part dimensions and quantities for this quote.
            </p>
            {quoteImportPlateTypeLabel ? (
              <p className="text-xs text-muted-foreground pt-1">
                Plate type from General:{" "}
                <span className="font-medium text-foreground">{quoteImportPlateTypeLabel}</span>
              </p>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col divide-y divide-border/70">
            <MethodPhaseMetricStrip
              label="Quantity"
              value={qtySidebar}
            />
            <MethodPhaseMetricStrip
              label="Area (m²)"
              value={areaSidebar}
            />
            <MethodPhaseMetricStrip
              label="Weight (kg)"
              value={wtSidebar}
            />
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="shrink-0 ds-surface-header sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">
                  {quoteImportRightHeader.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">{quoteImportRightHeader.desc}</p>
              </div>
              {onPhaseBack && onPhaseComplete ? (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={handleQuotePhaseBack}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button type="button" className="gap-2" onClick={handleQuotePhaseComplete}>
                    <Check className="h-4 w-4" />
                    Complete
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{mainColumn}</div>
        </div>
      </div>

      <Dialog open={phaseBackConfirmOpen} onOpenChange={setPhaseBackConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Import Excel list?</DialogTitle>
            <DialogDescription>
              A file or mapping is in progress. Going back clears this import and removes lines added
              from this step until you import again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPhaseBackConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmQuotePhaseBack}>
              Leave and go back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={phaseCompleteDialogOpen} onOpenChange={setPhaseCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete import first</DialogTitle>
            <DialogDescription>
              Fix the following before you can complete and return to quote method.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
            {phaseCompleteLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" onClick={() => setPhaseCompleteDialogOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
