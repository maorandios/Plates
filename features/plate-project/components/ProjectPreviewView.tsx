"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  FileText,
  Hash,
  Layers,
  LayoutGrid,
  MoveHorizontal,
  MoveVertical,
  Package,
  Palette,
  Square,
  Tag,
  Weight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { t } from "@/lib/i18n";
import type { PlateProjectSessionSnapshot } from "@/lib/projects/plateProjectSnapshot";
import {
  getPlateProjectsList,
  subscribePlateProjectsListChanged,
} from "@/lib/projects/plateProjectList";
import { exportPartsPackage } from "@/lib/quotes/exportPartsPackage";
import { MATERIAL_TYPE_LABELS } from "@/types/materials";
import { exportQuotePdfFromDraft } from "@/features/quick-quote/lib/exportQuotePdfFromDraft";
import { finalizePlateTypeLabel } from "@/features/quick-quote/lib/finalizePlateTypeLabel";
import {
  finalizeDraftItemsFromQuoteParts,
  finalizeDraftLineToQuotePart,
  isFinalizeBendPlateRowShape,
  type FinalizeDraftLineItem,
} from "@/features/quick-quote/lib/finalizeLineRecalc";
import { mergeAllQuoteMethodParts } from "@/features/quick-quote/lib/mergeAllQuoteMethods";
import { jobSummaryFromParts } from "@/features/quick-quote/lib/deriveQuoteSelection";
import { buildQuotePdfFullPayload } from "@/features/quick-quote/lib/quotePdfPayload";
import {
  MOCK_MFG_PARAMETERS,
  MOCK_PRICING_SUMMARY,
} from "@/features/quick-quote/mock/quickQuoteMockData";
import type { QuotePartRow } from "@/features/quick-quote/types/quickQuote";
import { QuotePartGeometryPreview } from "@/features/quick-quote/components/QuotePartGeometryPreview";
import {
  PART_PREVIEW_DIALOG_CONTENT_CLASS,
  PreviewStatCell,
  StatValueUnitLeft,
} from "@/features/quick-quote/components/partPreviewModalShared";
import {
  formatQuickQuoteCurrencyAmount,
  quickQuoteCurrencySymbol,
} from "@/features/quick-quote/lib/quickQuoteCurrencies";
import { splitMaterialGradeAndFinish } from "@/features/quick-quote/lib/plateFields";

const PP = "quote.partsPhase" as const;
const FP = "quote.finalizePhase" as const;
const MOD = "quote.dxfPhase.partPreviewModal" as const;
const PRJ = "projectPreview" as const;
const PRICE_CCY = "ILS" as const;

const N_COLS = 13;

function equalColumnWidthsPct(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(10000 / n) / 100;
  const arr = Array.from({ length: n }, () => base);
  const sum = arr.reduce((a, b) => a + b, 0);
  arr[n - 1] = Math.round((arr[n - 1] + (100 - sum)) * 100) / 100;
  return arr;
}

const METRIC_VALUE_ROW =
  "inline-flex flex-wrap items-baseline justify-center gap-x-1 font-semibold tabular-nums text-[#6A23F7] text-[1.875rem] leading-none tracking-tight sm:text-[2.0625rem]";
const METRIC_UNIT_CLASS =
  "font-semibold tabular-nums text-muted-foreground text-[0.72em] leading-none";

function PreviewMetricCard({
  icon: Icon,
  glyph,
  title,
  valueLine,
}: {
  icon?: LucideIcon;
  glyph?: ReactNode;
  title: string;
  valueLine: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[8rem] min-w-0 flex-1 flex-col items-center justify-center gap-2 px-3 py-4 text-center sm:min-h-[9.5rem] sm:px-4 sm:py-5">
      {glyph ?? (
        Icon ? (
          <Icon
            className="h-5 w-5 shrink-0 text-muted-foreground/70 sm:h-6 sm:w-6"
            strokeWidth={1.75}
            aria-hidden
          />
        ) : null
      )}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className={METRIC_VALUE_ROW}>{valueLine}</div>
    </div>
  );
}

function finishLabelFromCode(code: string): string {
  const key = `quote.finishLabels.${code}`;
  const label = t(key);
  return label === key ? code : label;
}

function roundDisplay(n: number, dp: number): string {
  return formatDecimal(n, dp);
}

function formatCreated(iso: string): string {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export interface ProjectPreviewListMeta {
  customerName: string;
  projectName: string;
  referenceNumber: string;
  createdAtIso: string;
}

export interface ProjectPreviewViewProps {
  projectId: string;
  snapshot: PlateProjectSessionSnapshot;
  listMeta: ProjectPreviewListMeta;
}

/** Read-only BOM + exports for a saved plate project — layout matches {@link QuotePreviewView}. */
export function ProjectPreviewView({
  projectId,
  snapshot,
  listMeta: listMetaProp,
}: ProjectPreviewViewProps) {
  const {
    jobDetails,
    materialType,
    manualQuoteRows,
    excelImportQuoteRows,
    dxfMethodGeometries,
    bendPlateQuoteItems,
  } = snapshot;

  const [listMeta, setListMeta] = useState<ProjectPreviewListMeta>(listMetaProp);
  const [packageExporting, setPackageExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [previewPart, setPreviewPart] = useState<QuotePartRow | null>(null);

  /** Projects have no pricing step in the wizard — empty map until we persist per-row $/kg on snapshots. */
  const materialPricePerKgByRow = useMemo(() => ({} as Record<string, string>), []);

  const mergedParts = useMemo(
    () =>
      mergeAllQuoteMethodParts(
        materialType,
        manualQuoteRows,
        excelImportQuoteRows,
        dxfMethodGeometries,
        bendPlateQuoteItems
      ),
    [
      materialType,
      manualQuoteRows,
      excelImportQuoteRows,
      dxfMethodGeometries,
      bendPlateQuoteItems,
    ]
  );

  const draftItems = useMemo(
    () => finalizeDraftItemsFromQuoteParts(mergedParts, materialType, materialPricePerKgByRow),
    [mergedParts, materialType, materialPricePerKgByRow]
  );

  const pdfDraft = useMemo(() => {
    if (mergedParts.length === 0) return null;
    return buildQuotePdfFullPayload(
      jobDetails,
      jobSummaryFromParts(mergedParts),
      mergedParts,
      MOCK_MFG_PARAMETERS,
      MOCK_PRICING_SUMMARY,
      materialType,
      materialPricePerKgByRow
    );
  }, [jobDetails, mergedParts, materialType, materialPricePerKgByRow]);

  const syncFromList = useCallback(() => {
    const row = getPlateProjectsList().find((p) => p.id === projectId);
    if (!row) return;
    setListMeta({
      customerName: row.customerName?.trim() ?? "",
      projectName: row.projectName?.trim() ?? "",
      referenceNumber: row.referenceNumber?.trim() ?? "",
      createdAtIso: row.createdAt,
    });
  }, [projectId]);

  useEffect(() => {
    setListMeta(listMetaProp);
  }, [listMetaProp]);

  useEffect(() => {
    syncFromList();
    return subscribePlateProjectsListChanged(syncFromList);
  }, [syncFromList]);

  const finalizeStripMetrics = useMemo(() => {
    const items = draftItems;
    const plateTypes = items.length;
    const totalQty = items.reduce((s, it) => s + Math.max(0, Math.floor(it.qty)), 0);
    const rawArea = items.reduce((s, it) => s + Math.max(0, it.area_m2), 0);
    const totalAreaM2 = Math.round(rawArea * 100) / 100;
    const rawWeight = items.reduce((s, it) => s + Math.max(0, it.weight_kg), 0);
    const totalWeightKg = Math.round(rawWeight * 10) / 10;
    const totalPrice = items.reduce((s, it) => s + Math.max(0, it.line_total), 0);
    return { plateTypes, totalQty, totalAreaM2, totalWeightKg, totalPrice };
  }, [draftItems]);

  const plateTableColWidths = useMemo(() => equalColumnWidthsPct(N_COLS), []);

  const headBase =
    "sticky top-0 z-30 !h-auto min-h-[3.5rem] py-3.5 pe-3 ps-3 text-sm font-semibold text-foreground align-middle whitespace-nowrap bg-card border-e border-border [vertical-align:middle] shadow-[0_1px_0_0_hsl(var(--border))]";
  const headStart = `${headBase} text-start`;
  const headNum = `${headBase} text-start tabular-nums`;
  const cellBase =
    "py-2.5 pe-3 ps-3 align-middle text-sm border-b border-border [vertical-align:middle]";
  const cellStart = `${cellBase} text-start min-w-0`;
  const cellNum = `${cellBase} text-start tabular-nums min-w-0`;
  const stickyViewHead = cn(
    headBase,
    "sticky end-0 z-[45] border-e-0 border-s border-border text-center shadow-[inset_1px_0_0_0_hsl(var(--border))]"
  );
  const stickyViewCell = cn(
    cellBase,
    "sticky end-0 z-20 border-e-0 border-s border-border bg-card shadow-[inset_1px_0_0_0_hsl(var(--border))] group-hover/row:bg-white/[0.03]"
  );

  function resolvePreviewBasePart(
    row: FinalizeDraftLineItem,
    rowIndex: number
  ): QuotePartRow | undefined {
    if (row.source_row_id?.trim()) {
      const byId = mergedParts.find((p) => p.id === row.source_row_id);
      if (byId) return byId;
    }
    return mergedParts[rowIndex];
  }

  function openPreviewForRow(row: FinalizeDraftLineItem, rowIndex: number) {
    const base = resolvePreviewBasePart(row, rowIndex);
    setPreviewPart(finalizeDraftLineToQuotePart(row, materialType, base));
  }

  const pv = previewPart;
  const previewTotalWeightLine = pv ? pv.weightKg * pv.qty : 0;
  const previewLineAreaM2 = pv ? pv.areaM2 * pv.qty : 0;
  const { finish: previewFinishLabel } = splitMaterialGradeAndFinish(pv?.material ?? "");

  const notesBlocks = useMemo(() => {
    const g = jobDetails.notes?.trim();
    if (!g) return [];
    return [{ title: t(`${PRJ}.notesGeneral`), body: g }];
  }, [jobDetails.notes]);

  const handleExportPdf = async () => {
    if (!pdfDraft || pdfExporting) return;
    setExportError(null);
    setPdfExporting(true);
    try {
      await exportQuotePdfFromDraft(pdfDraft, MATERIAL_TYPE_LABELS[materialType]);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : t("quote.finalizePhase.exportFailed"));
    } finally {
      setPdfExporting(false);
    }
  };

  const handleExportPackage = async () => {
    if (mergedParts.length === 0 || packageExporting) return;
    setExportError(null);
    setPackageExporting(true);
    try {
      await exportPartsPackage(
        mergedParts,
        dxfMethodGeometries,
        bendPlateQuoteItems,
        jobDetails.referenceNumber?.trim() || "project",
        materialType,
        { customerName: listMeta.customerName }
      );
    } catch (err) {
      console.error(err);
      setExportError(t(`${PRJ}.exportError`));
    } finally {
      setPackageExporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 pt-6 lg:pt-8" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 text-start">
          <div className="grid max-w-xl grid-cols-2 gap-x-3 gap-y-4 text-sm sm:max-w-2xl sm:gap-x-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/85">
                {t("quotes.colClient")}
              </span>
              <span className="text-muted-foreground">
                {listMeta.customerName.trim() || "—"}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/85">
                {t("quotes.colProject")}
              </span>
              <span className="text-muted-foreground">
                {listMeta.projectName.trim() || "—"}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/85">
                {t("quotes.colReference")}
              </span>
              <span className="min-w-0 text-start text-muted-foreground">
                <bdi className="tabular-nums">{listMeta.referenceNumber.trim() || "—"}</bdi>
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/85">
                {t("quotes.colCreated")}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatCreated(listMeta.createdAtIso)}
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/projects" className="inline-flex items-center gap-2">
            <span>{t(`${PRJ}.backToList`)}</span>
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="ds-surface text-start">
        <div className="space-y-5 p-4 sm:p-6">
          <div dir="rtl" className="text-start">
            <div className="overflow-hidden rounded-md border border-border bg-white/[0.08]">
              <div className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-5">
                <div className="bg-card">
                  <PreviewMetricCard
                    icon={Layers}
                    title={t(`${PP}.cardPlateTypesLabel`)}
                    valueLine={<>{formatInteger(finalizeStripMetrics.plateTypes)}</>}
                  />
                </div>
                <div className="bg-card">
                  <PreviewMetricCard
                    icon={Package}
                    title={t(`${PP}.cardPlateQtyLabel`)}
                    valueLine={<>{formatInteger(finalizeStripMetrics.totalQty)}</>}
                  />
                </div>
                <div className="bg-card">
                  <PreviewMetricCard
                    icon={LayoutGrid}
                    title={t(`${PP}.cardAreaLabel`)}
                    valueLine={
                      <>
                        <span>{formatDecimal(finalizeStripMetrics.totalAreaM2, 2)}</span>
                        <span className={METRIC_UNIT_CLASS}>{t("methodMetrics.unitM2")}</span>
                      </>
                    }
                  />
                </div>
                <div className="bg-card">
                  <PreviewMetricCard
                    icon={Weight}
                    title={t(`${PP}.cardWeightLabel`)}
                    valueLine={
                      <>
                        <span>{formatDecimal(finalizeStripMetrics.totalWeightKg, 1)}</span>
                        <span className={METRIC_UNIT_CLASS}>{t("methodMetrics.unitKg")}</span>
                      </>
                    }
                  />
                </div>
                <div className="bg-card">
                  <PreviewMetricCard
                    glyph={
                      <span
                        className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center text-[1.2rem] font-semibold leading-none text-muted-foreground/70 sm:h-6 sm:text-[1.35rem]"
                        aria-hidden
                      >
                        ₪
                      </span>
                    }
                    title={t(`quote.finalizePhase.cardQuotePriceLabel`)}
                    valueLine={
                      <>
                        <span>
                          {formatQuickQuoteCurrencyAmount(
                            finalizeStripMetrics.totalPrice,
                            PRICE_CCY
                          )}
                        </span>
                        <span className={METRIC_UNIT_CLASS}>
                          {quickQuoteCurrencySymbol(PRICE_CCY)}
                        </span>
                      </>
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <Card dir="rtl" className="border-border bg-card/40 text-start shadow-none">
            <CardHeader className="space-y-0 pb-3">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <CardTitle className="text-base leading-tight">
                  {t(`${PRJ}.plateDetailTableTitle`)}
                </CardTitle>
                <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        draftItems.length === 0 ||
                        pdfExporting ||
                        packageExporting
                      }
                      onClick={() => void handleExportPdf()}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
                      {pdfExporting
                        ? t(`quotePreview.exportPdfBuilding`)
                        : t(`quotePreview.exportPdfQuote`)}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        mergedParts.length === 0 || packageExporting || pdfExporting
                      }
                      onClick={() => void handleExportPackage()}
                      className="gap-2"
                    >
                      <Package className="h-4 w-4 shrink-0" aria-hidden />
                      {packageExporting
                        ? t(`quotePreview.exportBuilding`)
                        : t(`quotePreview.exportExecutionPackage`)}
                    </Button>
                  </div>
                  {exportError ? (
                    <p className="max-w-full text-sm text-destructive">{exportError}</p>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 sm:px-0">
              <div className="px-4 pb-4 sm:px-6">
                <div className="rounded-md border border-border bg-card">
                  <Table
                    dir="rtl"
                    containerClassName="overflow-visible"
                    className={cn(
                      "table-fixed border-collapse text-start",
                      "min-w-[1060px] w-full",
                      "[&_th]:text-start [&_td]:text-start"
                    )}
                  >
                    <colgroup>
                      {plateTableColWidths.map((pct, i) => (
                        <col key={i} style={{ width: `${pct}%` }} />
                      ))}
                    </colgroup>
                    <TableHeader className="relative isolate z-30 border-b border-border bg-card [&_th]:bg-card [&_tr]:border-b-0">
                      <TableRow className="border-b-0 hover:bg-transparent">
                        <TableHead scope="col" className={headStart}>
                          {t(`${FP}.colDescription`)}
                        </TableHead>
                        <TableHead scope="col" className={headStart}>
                          {t(`${FP}.colPartNumberShort`)}
                        </TableHead>
                        <TableHead scope="col" className={headNum}>
                          {t(`${FP}.colQty`)}
                        </TableHead>
                        <TableHead scope="col" className={headNum}>
                          {t(`${FP}.colThickness`)}
                        </TableHead>
                        <TableHead scope="col" className={headNum}>
                          {t(`${FP}.colLengthMm`)}
                        </TableHead>
                        <TableHead scope="col" className={headNum}>
                          {t(`${FP}.colWidthMm`)}
                        </TableHead>
                        <TableHead scope="col" className={headNum}>
                          {t(`${FP}.colAreaM2`)}
                        </TableHead>
                        <TableHead scope="col" className={headNum}>
                          {t(`${FP}.colWeightKg`)}
                        </TableHead>
                        <TableHead scope="col" className={headStart}>
                          {t(`${FP}.colMaterialGrade`)}
                        </TableHead>
                        <TableHead scope="col" className={headStart}>
                          {t(`${FP}.colFinish`)}
                        </TableHead>
                        <TableHead
                          scope="col"
                          className={cn(headBase, "min-w-[3.25rem] text-center")}
                        >
                          {t(`${FP}.colCorrugated`)}
                        </TableHead>
                        <TableHead scope="col" className={headNum}>
                          {t(`${FP}.colPrice`)}
                        </TableHead>
                        <TableHead scope="col" className={cn(stickyViewHead, "min-w-[4.5rem]")}>
                          {t(`${FP}.colView`)}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftItems.map((row, i) => (
                        <TableRow
                          key={row.source_row_id ?? `row-${i}`}
                          className="group/row hover:bg-white/[0.03]"
                        >
                          <TableCell className={cn(cellStart, "border-e border-border")}>
                            <span className="block min-w-0 truncate px-0.5 py-1.5 text-sm font-medium">
                              {finalizePlateTypeLabel(row.plate_shape)}
                            </span>
                          </TableCell>
                          <TableCell className={cn(cellStart, "border-e border-border text-sm")}>
                            {row.part_number}
                          </TableCell>
                          <TableCell className={cn(cellNum, "border-e border-border text-xs")}>
                            {row.qty}
                          </TableCell>
                          <TableCell className={cn(cellNum, "border-e border-border text-xs")}>
                            {roundDisplay(row.thickness_mm, 3)}
                          </TableCell>
                          <TableCell className={cn(cellNum, "border-e border-border text-xs")}>
                            {roundDisplay(row.length_mm, 3)}
                          </TableCell>
                          <TableCell className={cn(cellNum, "border-e border-border text-xs")}>
                            {roundDisplay(row.width_mm, 3)}
                          </TableCell>
                          <TableCell className={cn(cellNum, "border-e border-border text-xs")}>
                            {roundDisplay(row.area_m2, 4)}
                          </TableCell>
                          <TableCell className={cn(cellNum, "border-e border-border text-xs")}>
                            {roundDisplay(row.weight_kg, 3)}
                          </TableCell>
                          <TableCell className={cn(cellStart, "border-e border-border text-xs")}>
                            {row.material_grade}
                          </TableCell>
                          <TableCell className={cn(cellStart, "border-e border-border text-xs")}>
                            {row.finish}
                          </TableCell>
                          <TableCell
                            className={cn(cellBase, "border-e border-border text-center")}
                          >
                            {isFinalizeBendPlateRowShape(row.plate_shape) ? (
                              <div className="flex justify-center py-0.5">
                                <Checkbox
                                  checked={row.corrugated === true}
                                  disabled
                                  aria-label={t(`${FP}.ariaCorrugatedRow`, {
                                    name: row.part_number || String(i + 1),
                                  })}
                                />
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              cellNum,
                              "border-e border-border text-xs font-medium text-foreground"
                            )}
                          >
                            {formatQuickQuoteCurrencyAmount(row.line_total, PRICE_CCY)}
                          </TableCell>
                          <TableCell className={cn(stickyViewCell, "text-center")}>
                            <button
                              type="button"
                              aria-label={t(`${FP}.ariaPreviewRow`, {
                                name: row.part_number || String(i + 1),
                              })}
                              onClick={() => openPreviewForRow(row, i)}
                              className={cn(
                                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                                "text-[#6A23F7]",
                                "hover:bg-white/5",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              )}
                            >
                              <Eye className="h-4 w-4" stroke="#6A23F7" strokeWidth={2} aria-hidden />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {notesBlocks.length > 0 ? (
            <Card dir="rtl" className="border-border bg-card/40 text-start shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t(`quotePreview.notesTitle`)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed">
                {notesBlocks.map((b, idx) => (
                  <div key={`${b.title}-${idx}`} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{b.title}</p>
                    <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/20 px-3 py-2 text-start">
                      {b.body}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog
        open={previewPart !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPart(null);
        }}
      >
        <DialogContent showCloseButton={false} className={cn(PART_PREVIEW_DIALOG_CONTENT_CLASS)}>
          {pv ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden" dir="rtl">
              <DialogTitle className="sr-only">{pv.partName}</DialogTitle>
              <DialogDescription className="sr-only">{t(`${MOD}.a11yTitle`)}</DialogDescription>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  className="flex min-h-[min(45vh,475px)] flex-1 shrink-0 items-center justify-center px-5 py-6"
                  dir="ltr"
                >
                  <div className="relative flex h-[min(425px,52vh)] w-full min-w-0 max-w-full items-center justify-center overflow-hidden bg-transparent">
                    <QuotePartGeometryPreview
                      part={pv}
                      dxfGeometries={dxfMethodGeometries}
                      rectangleAppearance="dxfPreviewModal"
                      className="min-h-0 w-full max-w-full border-0 bg-transparent shadow-none [&>div]:min-h-0 [&>div]:bg-transparent [&_svg]:max-h-[min(400px,48vh)]"
                    />
                  </div>
                </div>
                <div className="w-full shrink-0 border-t border-border">
                  <div dir="ltr" className="w-full overflow-hidden">
                    <div className="grid w-full grid-cols-4 grid-rows-2">
                      {(
                        [
                          {
                            key: "finish",
                            icon: Palette,
                            label: t(`${MOD}.finish`),
                            value: finishLabelFromCode(previewFinishLabel),
                          },
                          {
                            key: "thickness",
                            icon: Layers,
                            label: t(`${MOD}.thickness`),
                            value: (
                              <StatValueUnitLeft
                                numericText={formatDecimal(Number(pv.thicknessMm) || 0, 1)}
                                unitSuffix={t(`${MOD}.mmSuffix`)}
                              />
                            ),
                          },
                          {
                            key: "quantity",
                            icon: Hash,
                            label: t(`${MOD}.quantity`),
                            value: Math.max(0, Math.floor(pv.qty)),
                          },
                          {
                            key: "plateName",
                            icon: Tag,
                            label: t(`${MOD}.plateName`),
                            value: pv.partName,
                          },
                          {
                            key: "weight",
                            icon: Weight,
                            label: t(`${MOD}.weight`),
                            value:
                              previewTotalWeightLine > 0 ? (
                                <StatValueUnitLeft
                                  numericText={formatDecimal(previewTotalWeightLine, 2)}
                                  unitSuffix={t(`${MOD}.kgSuffix`)}
                                />
                              ) : (
                                "-"
                              ),
                          },
                          {
                            key: "area",
                            icon: Square,
                            label: t(`${MOD}.area`),
                            value:
                              previewLineAreaM2 > 0 ? (
                                <StatValueUnitLeft
                                  numericText={formatDecimal(previewLineAreaM2, 4)}
                                  unitSuffix={t(`${MOD}.m2Suffix`)}
                                />
                              ) : (
                                "-"
                              ),
                          },
                          {
                            key: "length",
                            icon: MoveHorizontal,
                            label: t(`${MOD}.length`),
                            value: (
                              <StatValueUnitLeft
                                numericText={formatDecimal(pv.lengthMm, 1)}
                                unitSuffix={t(`${MOD}.mmSuffix`)}
                              />
                            ),
                          },
                          {
                            key: "width",
                            icon: MoveVertical,
                            label: t(`${MOD}.width`),
                            value: (
                              <StatValueUnitLeft
                                numericText={formatDecimal(pv.widthMm, 1)}
                                unitSuffix={t(`${MOD}.mmSuffix`)}
                              />
                            ),
                          },
                        ] as const
                      ).map((cell, idx) => (
                        <PreviewStatCell
                          key={cell.key}
                          icon={cell.icon}
                          label={cell.label}
                          value={cell.value}
                          className={cn(
                            "border-b border-solid border-[#6A23F7]/20",
                            idx % 4 === 0 && "border-s",
                            idx % 4 !== 3 && "border-e"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
