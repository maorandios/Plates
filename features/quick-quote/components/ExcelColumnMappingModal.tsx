"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { AlertCircle, FileSpreadsheet, RefreshCw, ArrowRight, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  readExcelHeaders,
  parseExcelFileWithMapping,
  countEligibleExcelDataRows,
} from "@/lib/parsers/excelParser";
import { formatDecimal } from "@/lib/formatNumbers";
import type { ColumnMapping, ExcelRow } from "@/types";
import type { ExcelHeadersResult } from "@/lib/parsers/excelParser";
import { t } from "@/lib/i18n";

const NONE = "__none__";

const DXF_EXCEL_UI = "quote.dxfPhase";

interface MappingField {
  key: keyof Omit<ColumnMapping, "headerRowIdx">;
  required: boolean;
}

/** Same fields as {@link ExcelUploadStep} variant `dxf`; display order matches product UX (material last). */
const MAPPING_FIELDS: MappingField[] = [
  { key: "partNameCol", required: true },
  { key: "qtyCol", required: false },
  { key: "thkCol", required: false },
  { key: "lengthCol", required: false },
  { key: "widthCol", required: false },
  { key: "weightCol", required: false },
  { key: "matCol", required: false },
];

const MAPPING_COL_WIDTH_PCT = 100 / MAPPING_FIELDS.length;

function fieldLabelKey(fieldKey: MappingField["key"]): string {
  return `quote.excelColumnMapping.fields.${fieldKey}.label`;
}

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
      setParseError(t("quote.excelColumnMapping.headersReadError"));
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

  /** Same row count as Excel list upload strip — eligible data rows for current mapping. */
  const excelStripDataRowCount = useMemo(() => {
    if (!arrayBuffer || !mapping) return 0;
    try {
      return countEligibleExcelDataRows(arrayBuffer, mapping);
    } catch {
      return 0;
    }
  }, [arrayBuffer, mapping]);

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
        cells.push({ label: t(fieldLabelKey(field.key)), value });
      });

      return { rowIndex, cells };
    });
  }, [headersResult, mapping]);

  const handleComplete = useCallback(async () => {
    if (!arrayBuffer || !mapping || !file) return;
    if (!isMappingValid) {
      setParseError(t("quote.excelColumnMapping.mapPartNameBeforeComplete"));
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
        setParseError(t("quote.excelColumnMapping.noValidRows"));
        return;
      }

      const rowsWithIds: ExcelRow[] = result.rows.map((row, index) => ({
        ...row,
        id: `excel-row-${index}`,
      }));

      onComplete(rowsWithIds);
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : t("quote.excelColumnMapping.parseFailed")
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
        <DialogContent
          dir="rtl"
          showCloseButton={false}
          className="w-[min(calc(100vw-2rem),56rem)] max-w-[min(calc(100vw-2rem),56rem)] max-h-[min(92vh,960px)] flex flex-col gap-0 p-0"
        >
          <DialogHeader className="shrink-0 px-4 pt-4 pb-2 sm:px-5 border-b text-start sm:text-start">
            <DialogTitle>{t("quote.excelColumnMapping.title")}</DialogTitle>
            <DialogDescription>
              {t("quote.excelColumnMapping.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 space-y-3">
            {file && headersResult && mapping && (
              <>
                <div className="flex w-full justify-start">
                  <div className="min-w-0 w-full max-w-full sm:max-w-[50%]">
                    <div className="flex w-full flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <FileSpreadsheet
                          className="h-5 w-5 shrink-0 text-primary"
                          aria-hidden
                        />
                        <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                              {t(`${DXF_EXCEL_UI}.excelUploadedFileName`)}
                            </p>
                            <p className="truncate text-sm font-medium text-foreground" title={file.name}>
                              {file.name}
                            </p>
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                              {t(`${DXF_EXCEL_UI}.excelUploadedFileSize`)}
                            </p>
                            <p className="text-sm font-medium tabular-nums text-foreground">
                              {formatDecimal(file.size / 1024, 1)} KB
                            </p>
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                              {t(`${DXF_EXCEL_UI}.excelUploadedRowCount`)}
                            </p>
                            <p className="text-sm font-medium tabular-nums text-primary/90 dark:text-primary/80">
                              {t(`${DXF_EXCEL_UI}.excelUploadedRowsDetectedValue`, {
                                n: excelStripDataRowCount,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={requestDiscard}
                        className="shrink-0 self-center"
                        aria-label={t(`${DXF_EXCEL_UI}.excelRemoveFileAria`)}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </div>

                <Card className="min-w-0 w-full">
                  <CardHeader className="px-3 pb-4 pt-2 sm:px-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {t("quote.excelColumnMapping.mappingSectionTitle")}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("quote.excelColumnMapping.mappingSectionHint")}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetToAutoDetected}
                        className="gap-2 shrink-0"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t("quote.excelColumnMapping.resetAuto")}
                      </Button>
                    </div>
                  </CardHeader>
                  {/* Flush with scroll area edges: override Card default p-6 so bordered table aligns with file strip above */}
                  <CardContent className="min-w-0 space-y-4 px-0 pb-4 pt-1">
                    {previewData && (
                      <div className="min-w-0 space-y-3">
                        <div className="min-w-0 overflow-x-auto rounded-md border">
                          <Table
                            containerClassName="overflow-visible"
                            className="w-full max-w-full table-fixed border-collapse text-sm"
                          >
                            <colgroup>
                              {MAPPING_FIELDS.map((field) => (
                                <col
                                  key={field.key}
                                  style={{ width: `${MAPPING_COL_WIDTH_PCT}%` }}
                                />
                              ))}
                            </colgroup>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                {MAPPING_FIELDS.map((field) => {
                                  const currentValue = mapping[field.key];
                                  const valueStr =
                                    currentValue !== null && currentValue !== undefined
                                      ? String(currentValue)
                                      : NONE;

                                  return (
                                    <TableHead
                                      key={field.key}
                                      className="!h-auto min-w-0 align-top !px-2.5 !py-2.5 text-start sm:!px-3"
                                    >
                                      <div className="min-w-0 space-y-1.5">
                                        <div className="flex min-w-0 items-baseline gap-1">
                                          <span className="break-words text-xs font-semibold leading-snug sm:text-sm">
                                            {t(fieldLabelKey(field.key))}
                                          </span>
                                          {field.required && (
                                            <span className="shrink-0 text-destructive text-sm">
                                              *
                                            </span>
                                          )}
                                        </div>
                                        <Select
                                          value={valueStr}
                                          onValueChange={(v) => updateMapping(field.key, v)}
                                        >
                                          <SelectTrigger className="h-8 w-full min-w-0 max-w-full px-2 text-xs sm:text-sm [&>span]:min-w-0 [&>span]:truncate">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value={NONE}>
                                              <span className="text-muted-foreground text-xs">
                                                {t("quote.excelColumnMapping.none")}
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
                                    <TableCell
                                      key={cellIndex}
                                      className="min-w-0 overflow-hidden !px-2.5 !py-2 align-middle text-start text-sm tabular-nums leading-normal sm:!px-3"
                                    >
                                      <span
                                        className="block min-w-0 truncate"
                                        title={cell.value}
                                      >
                                        {cell.value}
                                      </span>
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <p className="px-3 text-xs text-muted-foreground">
                          {t("quote.excelColumnMapping.previewRows")}
                        </p>
                      </div>
                    )}

                    {!isMappingValid && (
                      <div className="flex items-center gap-2 px-3 text-amber-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p className="text-sm">{t("quote.excelColumnMapping.partNameRequired")}</p>
                      </div>
                    )}

                    {parseError && (
                      <div className="mx-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive">{parseError}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {!file || !headersResult || !mapping ? (
              <p className="text-sm text-muted-foreground">{t("quote.excelColumnMapping.loading")}</p>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 w-full border-t border-white/[0.08] bg-card/40 px-4 py-3 sm:px-5">
            <Button
              type="button"
              onClick={() => void handleComplete()}
              disabled={!isMappingValid || !mapping || !arrayBuffer}
            >
              {t("quote.excelColumnMapping.complete")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 inline-flex flex-row"
              onClick={requestDiscard}
            >
              {t("common.back")}
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent dir="rtl" showCloseButton={false} className="sm:max-w-md z-[100]">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t("quote.excelColumnMapping.discardTitle")}</DialogTitle>
            <DialogDescription>
              {t("quote.excelColumnMapping.discardDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="w-full gap-2">
            <Button type="button" variant="destructive" onClick={runDiscard}>
              {t("quote.excelColumnMapping.discardConfirm")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDiscardConfirmOpen(false)}>
              {t("quote.excelColumnMapping.discardCancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
