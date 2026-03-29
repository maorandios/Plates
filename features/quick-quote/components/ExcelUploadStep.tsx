"use client";

import { useState, useCallback, useMemo } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, RefreshCw, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { readExcelHeaders, parseExcelFileWithMapping } from "@/lib/parsers/excelParser";
import type { ColumnMapping, ExcelRow } from "@/types";
import type { ExcelHeadersResult } from "@/lib/parsers/excelParser";

const NONE = "__none__";

interface ExcelUploadStepProps {
  onDataApproved: (data: ExcelRow[]) => void;
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

type ExcelSubStep = 1 | 2 | 3;

const SUB_STEPS = [
  { step: 1 as ExcelSubStep, label: "Upload Excel" },
  { step: 2 as ExcelSubStep, label: "Map Columns" },
  { step: 3 as ExcelSubStep, label: "Review Data" },
];

export function ExcelUploadStep({ onDataApproved }: ExcelUploadStepProps) {
  const [subStep, setSubStep] = useState<ExcelSubStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [headersResult, setHeadersResult] = useState<ExcelHeadersResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [parsedRows, setParsedRows] = useState<ExcelRow[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setUploadError(null);
    setParseError(null);
    setFile(selectedFile);
    setParsedRows(null);
    
    try {
      const buffer = await selectedFile.arrayBuffer();
      setArrayBuffer(buffer);
      
      // Read headers and auto-detect columns
      const headers = readExcelHeaders(buffer);
      setHeadersResult(headers);
      setMapping(headers.autoDetected);
      
      // Move to mapping step
      setSubStep(2);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to read Excel file"
      );
      setFile(null);
      setArrayBuffer(null);
    }
  }, []);

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
  }, []);

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

      // Add IDs to rows
      const rowsWithIds: ExcelRow[] = result.rows.map((row, index) => ({
        ...row,
        id: `excel-row-${index}`,
      }));

      setParsedRows(rowsWithIds);
      
      // Move to review step
      setSubStep(3);
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Failed to parse Excel file"
      );
    }
  }, [arrayBuffer, mapping, file]);
  
  const handleBackToMapping = useCallback(() => {
    setSubStep(2);
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

  const handleContinueToNextPhase = useCallback(() => {
    if (parsedRows) {
      onDataApproved(parsedRows);
    }
  }, [parsedRows, onDataApproved]);

  const previewData = useMemo(() => {
    if (!headersResult || !mapping) return null;
    
    return headersResult.previewRows.slice(0, 3).map((row, rowIndex) => {
      const cells: { label: string; value: string }[] = [];
      
      MAPPING_FIELDS.forEach((field) => {
        const colIdx = mapping[field.key];
        const value = colIdx !== null && colIdx !== undefined 
          ? String(row[colIdx] ?? "-")
          : "-";
        cells.push({ label: field.label, value });
      });
      
      return { rowIndex, cells };
    });
  }, [headersResult, mapping]);

  return (
    <div className="space-y-6">
      {/* Sub-Stepper */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            {SUB_STEPS.map(({ step, label }, index) => {
              const isComplete = step < subStep;
              const isCurrent = step === subStep;
              const isReachable = step <= subStep || (step === 2 && file !== null);

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

      {/* Step 1: Upload Section */}
      {subStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Excel/CSV</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your bill of materials with part details
            </p>
          </CardHeader>
          <CardContent>
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
                  id="excel-upload"
                />
                <Button asChild variant="outline">
                  <label htmlFor="excel-upload" className="cursor-pointer">
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

      {/* Step 2: Column Mapping */}
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
              {/* Mapping Table with Dropdowns in Header */}
              {previewData && (
                <div className="space-y-2">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        {/* Mapping Row */}
                        <TableRow className="bg-muted/30">
                          {MAPPING_FIELDS.map((field) => {
                            const currentValue = mapping[field.key];
                            const valueStr = currentValue !== null && currentValue !== undefined 
                              ? String(currentValue) 
                              : NONE;
                            
                            return (
                              <TableHead key={field.key} className="p-2">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold">
                                      {field.label}
                                    </span>
                                    {field.required && (
                                      <span className="text-destructive text-xs">*</span>
                                    )}
                                  </div>
                                  <Select value={valueStr} onValueChange={(v) => updateMapping(field.key, v)}>
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
                        {/* Preview Rows */}
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
                  <p className="text-xs text-muted-foreground">
                    Preview (first 3 rows)
                  </p>
                </div>
              )}

              {/* Parse Button */}
              <div className="flex items-center justify-between pt-4 border-t">
                {!isMappingValid && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm">Part Name is required</p>
                  </div>
                )}
                {isMappingValid && (
                  <div className="flex-1" />
                )}
                <Button
                  onClick={handleParseWithMapping}
                  disabled={!isMappingValid}
                  size="lg"
                >
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

      {/* Step 3: Review Data */}
      {subStep === 3 && parsedRows && metrics && (
        <>
          {/* Metrics Section */}
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

          {/* Data Table Section */}
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

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBackToMapping}
            >
              Back to Mapping
            </Button>
            <Button
              onClick={handleContinueToNextPhase}
              size="lg"
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Continue to Next Phase
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
