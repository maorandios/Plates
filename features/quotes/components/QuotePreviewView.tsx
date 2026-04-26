"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  FileDown,
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
import type { QuoteSessionSnapshot } from "@/lib/quotes/quoteSnapshot";
import { getQuotesList, subscribeQuotesListChanged } from "@/lib/quotes/quoteList";
import { exportPartsPackage } from "@/lib/quotes/exportPartsPackage";
import { MATERIAL_TYPE_LABELS } from "@/types/materials";
import { exportQuotePdfFromDraft } from "@/features/quick-quote/lib/exportQuotePdfFromDraft";
import { finalizePlateTypeLabel } from "@/features/quick-quote/lib/finalizePlateTypeLabel";
import {
  finalizeDraftLineToQuotePart,
  type FinalizeDraftLineItem,
} from "@/features/quick-quote/lib/finalizeLineRecalc";
import type { QuotePartRow } from "@/features/quick-quote/types/quickQuote";
import { QuotePartGeometryPreview } from "@/features/quick-quote/components/QuotePartGeometryPreview";
import {
  PART_PREVIEW_DIALOG_CONTENT_CLASS,
  PreviewStatCell,
  StatValueUnitLeft,
} from "@/features/quick-quote/components/partPreviewModalShared";
import { formatQuickQuoteCurrencyAmount } from "@/features/quick-quote/lib/quickQuoteCurrencies";
import { splitMaterialGradeAndFinish } from "@/features/quick-quote/lib/plateFields";

const PP = "quote.partsPhase" as const;
const FP = "quote.finalizePhase" as const;
const MOD = "quote.dxfPhase.partPreviewModal" as const;
const QP = "quotePreview" as const;
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

/** Shared layout for preview export tiles; colors applied per action below. */
const PREVIEW_EXPORT_TILE_BASE = cn(
  "flex h-auto min-h-[10.5rem] w-[8.25rem] max-w-full shrink-0 flex-col items-center justify-center gap-2.5 border-2 px-2.5 py-3.5 shadow-md transition-colors sm:min-h-[11.5rem] sm:w-[9.5rem] sm:gap-3 sm:px-3 sm:py-4 md:w-44",
  "rounded-2xl sm:rounded-[1.25rem]",
  "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 disabled:shadow-none disabled:hover:bg-muted",
  "whitespace-normal text-center [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:!h-8 [&_svg]:!w-8 sm:[&_svg]:!h-10 sm:[&_svg]:!w-10"
);

/** PDF export — mint (same family as Quick Quote phase 7). */
const PREVIEW_EXPORT_TILE_PDF_CLASS = cn(
  PREVIEW_EXPORT_TILE_BASE,
  "border-[#00C7A5] bg-[#D2FFEE] text-[#14765F]",
  "hover:bg-[#c5f5e8] hover:border-[#00b396]",
  "focus-visible:ring-[#00C7A5]/45"
);

/** Package export — gray so it is visually distinct from PDF. */
const PREVIEW_EXPORT_TILE_PACKAGE_CLASS = cn(
  PREVIEW_EXPORT_TILE_BASE,
  "border-zinc-400 bg-zinc-200 text-zinc-800",
  "hover:bg-zinc-300 hover:border-zinc-500",
  "focus-visible:ring-zinc-500/40",
  "[&_svg]:stroke-zinc-800"
);
const PREVIEW_EXPORT_TILE_TEXT_CLASS =
  "max-w-[9rem] text-center text-xs font-semibold leading-snug sm:max-w-[10rem] sm:text-sm sm:leading-snug";

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
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return iso;
  }
}

export interface QuotePreviewListMeta {
  customerName: string;
  projectName: string;
  referenceNumber: string;
  createdAtIso: string;
}

export interface QuotePreviewViewProps {
  quoteId: string;
  snapshot: QuoteSessionSnapshot;
  listMeta: QuotePreviewListMeta;
}

export function QuotePreviewView({
  quoteId,
  snapshot,
  listMeta: listMetaProp,
}: QuotePreviewViewProps) {
  const { draft, materialType, mergedParts, dxfMethodGeometries } = snapshot;

  const [listMeta, setListMeta] = useState<QuotePreviewListMeta>(listMetaProp);
  const [packageExporting, setPackageExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [previewPart, setPreviewPart] = useState<QuotePartRow | null>(null);

  const syncFromList = useCallback(() => {
    const row = getQuotesList().find((q) => q.id === quoteId);
    if (!row) return;
    setListMeta({
      customerName: row.customerName?.trim() ?? "",
      projectName: row.projectName?.trim() ?? "",
      referenceNumber: row.referenceNumber?.trim() ?? "",
      createdAtIso: row.createdAt,
    });
  }, [quoteId]);

  useEffect(() => {
    setListMeta(listMetaProp);
  }, [listMetaProp]);

  useEffect(() => {
    syncFromList();
    return subscribeQuotesListChanged(syncFromList);
  }, [syncFromList]);

  const finalizeStripMetrics = useMemo(() => {
    const items = draft.items;
    const plateTypes = items.length;
    const totalQty = items.reduce((s, it) => s + Math.max(0, Math.floor(it.qty)), 0);
    const rawArea = items.reduce((s, it) => s + Math.max(0, it.area_m2), 0);
    const totalAreaM2 = Math.round(rawArea * 100) / 100;
    const rawWeight = items.reduce((s, it) => s + Math.max(0, it.weight_kg), 0);
    const totalWeightKg = Math.round(rawWeight * 10) / 10;
    return { plateTypes, totalQty, totalAreaM2, totalWeightKg };
  }, [draft.items]);

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

  /** Single block: finalize `draft.quote.notes` is canonical; fall back to legacy `generalNotes`. */
  const notesDisplay = useMemo(() => {
    const fromDraft = (draft.quote.notes ?? [])
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n");
    if (fromDraft) return fromDraft;
    return snapshot.generalNotes?.trim() ?? "";
  }, [snapshot.generalNotes, draft.quote.notes]);

  const handleExportPdf = async () => {
    if (draft.items.length === 0 || pdfExporting) return;
    setExportError(null);
    setPdfExporting(true);
    try {
      await exportQuotePdfFromDraft(draft, MATERIAL_TYPE_LABELS[materialType]);
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
        snapshot.bendPlateQuoteItems,
        draft.quote.quote_number || draft.quote.reference_number || "quote",
        materialType,
        { customerName: listMeta.customerName }
      );
    } catch (err) {
      console.error(err);
      setExportError(t(`${QP}.exportError`));
    } finally {
      setPackageExporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 pt-6 lg:pt-8" dir="rtl">
      <div
        className="flex w-full flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-6"
        dir="ltr"
      >
        {/*
          LTR: export tiles (left); company info card grows to fill the rest of the row.
          @see QuoteFinalizeExportStep PDF tile.
        */}
        <div className="flex max-w-full shrink-0 flex-nowrap items-start justify-start gap-3 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:overflow-visible sm:self-stretch [&::-webkit-scrollbar]:hidden">
          <Button
            type="button"
            variant="ghost"
            disabled={
              draft.items.length === 0 || pdfExporting || packageExporting
            }
            onClick={() => void handleExportPdf()}
            className={PREVIEW_EXPORT_TILE_PDF_CLASS}
          >
            <FileDown className="stroke-[1.65]" aria-hidden />
            <span className={PREVIEW_EXPORT_TILE_TEXT_CLASS}>
              {pdfExporting
                ? t(`${FP}.exporting`)
                : t(`${FP}.exportQuoteProduce`)}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={
              mergedParts.length === 0 || packageExporting || pdfExporting
            }
            onClick={() => void handleExportPackage()}
            className={PREVIEW_EXPORT_TILE_PACKAGE_CLASS}
          >
            <Package className="stroke-[1.65]" aria-hidden />
            <span className={PREVIEW_EXPORT_TILE_TEXT_CLASS}>
              {packageExporting
                ? t(`${QP}.exportBuilding`)
                : t(`${QP}.exportExecutionPackage`)}
            </span>
          </Button>
        </div>

        <div
          className="flex min-h-0 min-w-0 w-full flex-1 flex-col justify-center sm:min-h-[11.5rem]"
          dir="rtl"
        >
          {/*
            justify-start: align grid to the inline start (right in RTL).
            w-fit on grid: two columns sit next to each other (no 50% stretch gap).
          */}
          <div className="flex w-full min-w-0 justify-start">
            <div
              className={cn(
                "grid w-max max-w-full grid-cols-2 grid-rows-2",
                "gap-x-2 gap-y-3 sm:gap-x-3 sm:gap-y-4 md:gap-x-4"
              )}
            >
              {[
                {
                  label: t("quotes.colClient"),
                  value: listMeta.customerName.trim() || "—",
                  valueClass: "text-base font-semibold leading-snug sm:text-lg",
                },
                {
                  label: t("quotes.colProject"),
                  value: listMeta.projectName.trim() || "—",
                  valueClass:
                    "text-sm font-medium leading-relaxed sm:text-base",
                },
                {
                  label: t("quotes.colReference"),
                  value: listMeta.referenceNumber.trim() || "—",
                  valueClass:
                    "break-words font-mono text-sm font-medium tabular-nums sm:text-base",
                },
                {
                  label: t("quotes.colCreated"),
                  value: formatCreated(listMeta.createdAtIso),
                  valueClass:
                    "text-sm font-medium leading-relaxed text-foreground sm:text-base",
                },
              ].map((field) => (
                <div
                  key={field.label}
                  className="flex max-w-[min(100%,20rem)] min-w-0 flex-col items-start justify-center gap-1 text-start"
                >
                  <span className="w-full text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
                    {field.label}
                  </span>
                  <span
                    className={cn(
                      "w-full min-w-0 text-balance text-foreground",
                      field.valueClass
                    )}
                  >
                    {field.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {exportError ? (
        <p className="text-sm text-destructive" dir="rtl">
          {exportError}
        </p>
      ) : null}

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
                      <span>{formatDecimal(finalizeStripMetrics.totalAreaM2, 2)}</span>
                    }
                  />
                </div>
                <div className="bg-card">
                  <PreviewMetricCard
                    icon={Weight}
                    title={t(`${PP}.cardWeightLabel`)}
                    valueLine={
                      <span>{formatDecimal(finalizeStripMetrics.totalWeightKg, 1)}</span>
                    }
                  />
                </div>
                <div className="bg-card">
                  <PreviewMetricCard
                    icon={Tag}
                    title={t(`${FP}.cardQuotePriceLabel`)}
                    valueLine={
                      <span>
                        {formatQuickQuoteCurrencyAmount(
                          draft.pricing.total_price,
                          PRICE_CCY
                        )}
                      </span>
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <Card dir="rtl" className="border-border bg-card/40 text-start shadow-none">
            <CardHeader className="space-y-0 pb-3">
              <CardTitle className="text-base leading-tight">
                {t(`${FP}.plateDetailTableTitle`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-0">
              <div className="px-4 pb-4 sm:px-6">
                {/*
                  No overflow-* on this wrapper — any overflow (e.g. overflow-x-auto) makes
                  `position: sticky` on `th` use that box as the scrollport and breaks sticking
                  to `PageContainer` / main. Wide table uses min-w; main scrolls x+y like finalize.
                  @see QuoteFinalizeExportStep plate table comment.
                */}
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
                      {draft.items.map((row, i) => (
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
                            <div className="flex justify-center py-0.5">
                              <Checkbox
                                checked={row.corrugated === true}
                                disabled
                                aria-label={t(`${FP}.ariaCorrugatedRow`, {
                                  name: row.part_number || String(i + 1),
                                })}
                              />
                            </div>
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

          {notesDisplay ? (
            <Card dir="rtl" className="border-border bg-card/40 text-start shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t(`${QP}.notesTitle`)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed">
                <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/20 px-3 py-2 text-start">
                  {notesDisplay}
                </p>
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
