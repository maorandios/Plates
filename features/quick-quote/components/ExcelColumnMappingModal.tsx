"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  ArrowLeft,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { readExcelHeaders, parseExcelFileWithMapping } from "@/lib/parsers/excelParser";
import type { ColumnMapping, ExcelRow } from "@/types";
import type { ExcelHeadersResult } from "@/lib/parsers/excelParser";

const NONE = "__none__";

interface MappingField {
  key: keyof Omit<ColumnMapping, "headerRowIdx">;
  label: string;
  required: boolean;
  description: string;
}

/** Same fields as {@link ExcelUploadStep} variant `dxf`. */
const MAPPING_FIELDS: MappingField[] = [
  { key: "partNameCol", label: "Part Name", required: true, description: "Unique identifier for each part" },
  { key: "qtyCol", label: "Quantity", required: false, description: "Number of pieces (defaults to 1)" },
  { key: "thkCol", label: "Thickness", required: false, description: "Plate thickness in mm" },
  { key: "matCol", label: "Material", required: false, description: "Steel grade or material type" },
  { key: "lengthCol", label: "Length", required: false, description: "Plate length in mm" },
  { key: "widthCol", label: "Width", required: false, description: "Plate width in mm" },
  { key: "weightCol", label: "Weight", required: false, description: "Unit weight per piece in kg" },
];

export interface ExcelColumnMappingModalProps {
  open: boolean;
  file: File | null;
  arrayBuffer: ArrayBuffer | null;
  /** Called after mapping is valid and parsing produced at least one row. */
  onComplete: (rows: ExcelRow[]) => void;
  /** User discarded mapping — clear spreadsheet from the parent step. */
  onDiscard: () => void;
}

export function ExcelColumnMappingModal({
  open,
  file,
  arrayBuffer,
  onComplete,
  onDiscard,
}: ExcelColumnMappingModalProps) {
  const [headersResult, setHeadersResult] = useState<ExcelHeadersResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open || !arrayBuffer) {
      if (!open) {
        setHeadersResult(null);
        setMapping(null);
        setParseError(null);
      }
      return;
    }
    try {
      const headers = readExcelHeaders(arrayBuffer);
      setHeadersResult(headers);
      setMapping(headers.autoDetected);
      setParseError(null);
    } catch {
      setHeadersResult(null);
      setMapping(null);
      setParseError("Could not read spreadsheet headers.");
    }
  }, [open, arrayBuffer]);

  const updateMapping = useCallback(
    (field: MappingField["key"], value: string) => {
      if (!mapping) return;
      setMapping({
        ...mapping,
        [field]: value === NONE ? null : parseInt(value, 10),
      });
      setParseError(null);
    },
    [mapping]
  );

  const resetToAutoDetected = useCallback(() => {
    if (headersResult) {
      setMapping(headersResult.autoDetected);
      setParseError(null);
    }
  }, [headersResult]);

  const isMappingValid = useMemo(() => {
    if (!mapping) return false;
    return mapping.partNameCol !== null;
  }, [mapping]);

  const previewData = useMemo(() => {
    if (!headersResult || !mapping) return null;

    return headersResult.previewRows.slice(0, 3).map((row, rowIndex) => {
      const cells: { label: string; value: string }[] = [];

      MAPPING_FIELDS.forEach((field) => {
        const colIdx = mapping[field.key];
        const value =
          colIdx !== null && colIdx !== undefined
            ? String(row[colIdx] ?? "-")
            : "-";
        cells.push({ label: field.label, value });
      });

      return { rowIndex, cells };
    });
  }, [headersResult, mapping]);

  const handleComplete = useCallback(async () => {
    if (!arrayBuffer || !mapping || !file) return;
    if (!isMappingValid) {
      setParseError("Map Part Name to a column before completing.");
      return;
    }

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
        setParseError(
          "No valid rows found with current mapping. Please adjust the column mapping."
        );
        return;
      }

      const rowsWithIds: ExcelRow[] = result.rows.map((row, index) => ({
        ...row,
        id: `excel-row-${index}`,
      }));

      onComplete(rowsWithIds);
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Failed to parse spreadsheet"
      );
    }
  }, [arrayBuffer, mapping, file, isMappingValid, onComplete]);

  const runDiscard = useCallback(() => {
    setDiscardConfirmOpen(false);
    onDiscard();
  }, [onDiscard]);

  const requestDiscard = useCallback(() => {
    setDiscardConfirmOpen(true);
  }, []);

  const handleMainDialogOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        requestDiscard();
      }
    },
    [requestDiscard]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleMainDialogOpenChange}>
        <DialogContent className="max-w-[min(100vw-2rem,56rem)] max-h-[min(90vh,900px)] flex flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2 border-b">
            <DialogTitle>Map spreadsheet columns</DialogTitle>
            <DialogDescription>
              Match each field to a column in your file. Part Name is required. This is the same
              mapping as the Excel upload step in the main wizard.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {file && headersResult && mapping && (
              <>
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">File</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
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
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">Column mapping</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Map workbook columns to BOM fields
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetToAutoDetected}
                        className="gap-2 shrink-0"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reset to auto-detected
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {previewData && (
                      <div className="space-y-2">
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                {MAPPING_FIELDS.map((field) => {
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
                                              <span className="text-muted-foreground text-xs">
                                                None
                                              </span>
                                            </SelectItem>
                                            {headersResult.rawHeaders
                                              .filter((h) => h && h.trim())
                                              .map((header, index) => (
                                                <SelectItem
                                                  key={`${header}-${index}`}
                                                  value={String(index)}
                                                >
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

                    {!isMappingValid && (
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p className="text-sm">Part Name must be mapped to a column.</p>
                      </div>
                    )}

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

            {!file || !headersResult || !mapping ? (
              <p className="text-sm text-muted-foreground">Loading spreadsheet…</p>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 gap-2 px-6 py-4 border-t bg-muted/20 sm:justify-between">
            <Button type="button" variant="outline" className="gap-2" onClick={requestDiscard}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => void handleComplete()}
              disabled={!isMappingValid || !mapping || !arrayBuffer}
            >
              <Check className="h-4 w-4" />
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent className="sm:max-w-md z-[100]">
          <DialogHeader>
            <DialogTitle>Remove spreadsheet?</DialogTitle>
            <DialogDescription>
              Going back will clear the uploaded Excel or CSV file and remove all column mapping
              and imported BOM rows from this step. You can upload a file again at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDiscardConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={runDiscard}>
              Remove spreadsheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
