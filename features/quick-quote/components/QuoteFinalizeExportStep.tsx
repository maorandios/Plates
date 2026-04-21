"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
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
  Trash2,
  Weight,
} from "lucide-react";
import type { DxfPartGeometry } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { OptimisticCheckbox } from "@/components/ui/optimistic-checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MaterialType } from "@/types/materials";
import { finalizePlateTypeLabel } from "../lib/finalizePlateTypeLabel";
import {
  finalizeDraftLineToQuotePart,
  isFinalizeBendPlateRowShape,
  recalcFinalizeLineMetrics,
  type FinalizeDraftLineItem,
} from "../lib/finalizeLineRecalc";
import { splitMaterialGradeAndFinish } from "../lib/plateFields";
import type { QuotePartRow } from "../types/quickQuote";
import { QuotePartGeometryPreview } from "./QuotePartGeometryPreview";
import {
  PART_PREVIEW_DIALOG_CONTENT_CLASS,
  PreviewStatCell,
  StatValueUnitLeft,
} from "./partPreviewModalShared";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import {
  formatQuickQuoteCurrencyAmount,
  quickQuoteCurrencySymbol,
} from "../lib/quickQuoteCurrencies";
import {
  computeNetBeforeVat,
  computeQuoteTotalInclVat,
  computeVatAmount,
  type QuotePdfFullPayload,
} from "../lib/quotePdfPayload";
import { t } from "@/lib/i18n";

const FP = "quote.finalizePhase" as const;
/** Same labels as Part Breakdown metric strip (סוגי פלטות … משקל). */
const PP = "quote.partsPhase" as const;
const MOD = "quote.dxfPhase.partPreviewModal" as const;
/** Finalize “הצעת מחיר” matches Phase 6 material pricing (Israeli new shekel). */
const FINALIZE_PRICE_CURRENCY = "ILS" as const;

const N_PLATE_TABLE_COLS = 14;

function equalColumnWidthsPct(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(10000 / n) / 100;
  const arr = Array.from({ length: n }, () => base);
  const sum = arr.reduce((a, b) => a + b, 0);
  arr[n - 1] = Math.round((arr[n - 1] + (100 - sum)) * 100) / 100;
  return arr;
}

const PREVIEW_ICON_CLASS = "text-[#6A23F7]";
const PREVIEW_STROKE = "#6A23F7";

/** Editable cell inputs — pill outline to match Quick Quote tables. */
const FINALIZE_CELL_INPUT =
  "h-8 w-full min-w-0 rounded-full border border-border bg-muted/35 px-3 text-sm shadow-none text-foreground placeholder:text-muted-foreground focus-visible:border-[#6A23F7]/50 focus-visible:ring-1 focus-visible:ring-[#6A23F7]/30";

function finishLabelFromCode(code: string): string {
  const key = `quote.finishLabels.${code}`;
  const label = t(key);
  return label === key ? code : label;
}

/** Matches PartBreakdownTable summary metrics. */
const METRIC_VALUE_ROW =
  "inline-flex flex-wrap items-baseline justify-center gap-x-1 font-semibold tabular-nums text-[#6A23F7] text-[1.875rem] leading-none tracking-tight sm:text-[2.0625rem]";
const METRIC_UNIT_CLASS =
  "font-semibold tabular-nums text-muted-foreground text-[0.72em] leading-none";

function FinalizeSummaryMetricCard({
  icon: Icon,
  glyph,
  title,
  valueLine,
}: {
  icon?: LucideIcon;
  /** When set (e.g. ₪), replaces the Lucide icon — used for NIS pricing. */
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

/** UI shows dd/mm/yyyy; draft + API keep YYYY-MM-DD. */
function formatIsoToDdMmYyyy(iso: string): string {
  const s = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [ys, ms, ds] = s.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return s;
  }
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function parseDdMmYyyyToIso(display: string): string | null {
  const t = display.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface QuoteFinalizeExportStepProps {
  draft: QuotePdfFullPayload;
  setDraft: React.Dispatch<React.SetStateAction<QuotePdfFullPayload>>;
  /** Material family from General (Carbon / Stainless / Aluminum) — not editable in the table. */
  materialFamilyLabel: string;
  materialType: MaterialType;
  /** Same $/kg map as Pricing step — used for line price and recalculation. */
  materialPricePerKgByRow: Record<string, string>;
  /** BOM rows from the quote flow — used with {@link finalizeDraftLineToQuotePart} for DXF preview. */
  quotePartsForPreview: QuotePartRow[];
  dxfPartGeometries: DxfPartGeometry[] | null;
}

function num(v: string, fallback = 0): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function int(v: string, fallback = 0): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function roundToMaxDecimals(n: number, maxDp: number): number {
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** maxDp;
  return Math.round(n * p) / p;
}

/** Display up to 3 fraction digits (no thousands separators). */
function formatUpTo3Decimals(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format(n);
}

/** Sum of line prices from the part breakdown (subtotal before discount / VAT). */
function totalLineSellFromItems(items: FinalizeDraftLineItem[]): number {
  const raw = items.reduce((s, it) => s + Math.max(0, it.line_total), 0);
  return roundToMaxDecimals(raw, 2);
}

/** Job summary totals derived from part lines (PDF cards + export payload). */
function summarizeJobFromItems(items: FinalizeDraftLineItem[]) {
  const total_quantity = items.reduce(
    (s, it) => s + Math.max(0, Math.floor(it.qty)),
    0
  );
  const rawWeight = items.reduce((s, it) => s + Math.max(0, it.weight_kg), 0);
  return {
    total_parts: items.length,
    total_quantity,
    total_weight_kg: roundToMaxDecimals(rawWeight, 3),
  };
}

export function QuoteFinalizeExportStep({
  draft,
  setDraft,
  materialFamilyLabel,
  materialType,
  materialPricePerKgByRow,
  quotePartsForPreview,
  dxfPartGeometries,
}: QuoteFinalizeExportStepProps) {
  const [exporting, setExporting] = useState(false);
  const [quoteDateDisplay, setQuoteDateDisplay] = useState(() =>
    formatIsoToDdMmYyyy(draft.quote.quote_date)
  );
  const [validUntilDisplay, setValidUntilDisplay] = useState(() =>
    formatIsoToDdMmYyyy(draft.quote.valid_until)
  );
  const [quoteNumberCopied, setQuoteNumberCopied] = useState(false);
  const [previewPart, setPreviewPart] = useState<QuotePartRow | null>(null);
  /** Bumps when user clicks "איפוס מחיר" so row price inputs remount from recalculated values. */
  const [linePriceResetNonce, setLinePriceResetNonce] = useState(0);

  const plateTableColWidths = useMemo(
    () => equalColumnWidthsPct(N_PLATE_TABLE_COLS),
    []
  );

  /** Sync subtotal field when BOM lines change (recalculated total); not when user overrides amount. */
  const pricingLineItemsSig = useMemo(
    () => draft.items.map((i) => `${i.line_total}:${i.qty}`).join("|"),
    [draft.items]
  );
  const [subtotalField, setSubtotalField] = useState(() =>
    formatDecimal(draft.pricing.total_price, 2)
  );
  useEffect(() => {
    setSubtotalField(formatDecimal(draft.pricing.total_price, 2));
  }, [pricingLineItemsSig]); // eslint-disable-line react-hooks/exhaustive-deps -- BOM lines only; subtotal commits on blur

  useEffect(() => {
    setQuoteDateDisplay(formatIsoToDdMmYyyy(draft.quote.quote_date));
  }, [draft.quote.quote_date]);

  useEffect(() => {
    setValidUntilDisplay(formatIsoToDdMmYyyy(draft.quote.valid_until));
  }, [draft.quote.valid_until]);

  const finalizeStripMetrics = useMemo(() => {
    const items = draft.items;
    const plateTypes = items.length;
    const totalQty = items.reduce(
      (s, it) => s + Math.max(0, Math.floor(it.qty)),
      0
    );
    const rawArea = items.reduce((s, it) => s + Math.max(0, it.area_m2), 0);
    const totalAreaM2 = roundToMaxDecimals(rawArea, 2);
    const rawWeight = items.reduce((s, it) => s + Math.max(0, it.weight_kg), 0);
    const totalWeightKg = roundToMaxDecimals(rawWeight, 1);
    return {
      plateTypes,
      totalQty,
      totalAreaM2,
      totalWeightKg,
    };
  }, [draft.items]);

  const applyPartRowPatch = useCallback(
    (index: number, patch: Partial<FinalizeDraftLineItem>, recalc: boolean) => {
      setDraft((d) => {
        const items = d.items.map((it, j) => {
          if (j !== index) return it;
          const next: FinalizeDraftLineItem = {
            ...it,
            ...patch,
            material_type: materialFamilyLabel,
            plate_shape: it.plate_shape ?? "flat",
          };
          if (!recalc) return next;
          const { area_m2, weight_kg, line_total } = recalcFinalizeLineMetrics(
            next,
            materialType,
            materialPricePerKgByRow
          );
          return {
            ...next,
            area_m2,
            weight_kg,
            line_total,
          };
        });
        const jobTotals = summarizeJobFromItems(items);
        const lineTotalSum = totalLineSellFromItems(items);
        return {
          ...d,
          items,
          summary: { ...d.summary, ...jobTotals },
          pricing: {
            ...d.pricing,
            total_price: lineTotalSum,
            total_incl_vat: computeQuoteTotalInclVat(
              lineTotalSum,
              d.pricing.discount,
              d.pricing.vat_rate
            ),
          },
        };
      });
    },
    [materialFamilyLabel, materialPricePerKgByRow, materialType, setDraft]
  );

  const removeFinalizeRow = useCallback(
    (index: number) => {
      setDraft((d) => {
        const items = d.items.filter((_, j) => j !== index);
        const jobTotals = summarizeJobFromItems(items);
        const lineTotalSum = totalLineSellFromItems(items);
        return {
          ...d,
          items,
          summary: { ...d.summary, ...jobTotals },
          pricing: {
            ...d.pricing,
            total_price: lineTotalSum,
            total_incl_vat: computeQuoteTotalInclVat(
              lineTotalSum,
              d.pricing.discount,
              d.pricing.vat_rate
            ),
          },
        };
      });
    },
    [setDraft]
  );

  /** Manual line sell price: updates document total from sum of rows (does not touch the subtotal field logic beyond syncing draft.pricing). */
  const applyLineTotalPatch = useCallback(
    (index: number, lineTotal: number) => {
      setDraft((d) => {
        const items = d.items.map((it, j) =>
          j === index ? { ...it, line_total: roundToMaxDecimals(lineTotal, 6) } : it
        );
        const lineTotalSum = totalLineSellFromItems(items);
        const jobTotals = summarizeJobFromItems(items);
        return {
          ...d,
          items,
          summary: { ...d.summary, ...jobTotals },
          pricing: {
            ...d.pricing,
            total_price: lineTotalSum,
            total_incl_vat: computeQuoteTotalInclVat(
              lineTotalSum,
              d.pricing.discount,
              d.pricing.vat_rate
            ),
          },
        };
      });
    },
    [setDraft]
  );

  /** Recompute every row price from weight × ₪/kg (undoes manual line prices and manual subtotal). */
  const resetPricingToCalculated = useCallback(() => {
    setDraft((d) => {
      const items = d.items.map((it) => {
        const m = recalcFinalizeLineMetrics(it, materialType, materialPricePerKgByRow);
        return { ...it, ...m };
      });
      const lineTotalSum = totalLineSellFromItems(items);
      const jobTotals = summarizeJobFromItems(items);
      return {
        ...d,
        items,
        summary: { ...d.summary, ...jobTotals },
        pricing: {
          ...d.pricing,
          total_price: lineTotalSum,
          total_incl_vat: computeQuoteTotalInclVat(
            lineTotalSum,
            d.pricing.discount,
            d.pricing.vat_rate
          ),
        },
      };
    });
    setLinePriceResetNonce((n) => n + 1);
  }, [materialPricePerKgByRow, materialType, setDraft]);

  function resolvePreviewBasePart(
    row: FinalizeDraftLineItem,
    rowIndex: number
  ): QuotePartRow | undefined {
    if (row.source_row_id?.trim()) {
      const byId = quotePartsForPreview.find((p) => p.id === row.source_row_id);
      if (byId) return byId;
    }
    return quotePartsForPreview[rowIndex];
  }

  function openPreviewForRow(row: FinalizeDraftLineItem, rowIndex: number) {
    const base = resolvePreviewBasePart(row, rowIndex);
    setPreviewPart(
      finalizeDraftLineToQuotePart(row, materialType, base)
    );
  }

  const handleExportPdf = useCallback(async () => {
    if (draft.items.length === 0) return;
    setExporting(true);
    try {
      const quoteDateIso =
        parseDdMmYyyyToIso(quoteDateDisplay) ?? draft.quote.quote_date;
      const validUntilIso =
        parseDdMmYyyyToIso(validUntilDisplay) ?? draft.quote.valid_until;

      const subtotal = draft.pricing.total_price;
      const totalInclVat = computeQuoteTotalInclVat(
        subtotal,
        draft.pricing.discount,
        draft.pricing.vat_rate
      );
      const jobTotals = summarizeJobFromItems(draft.items);
      const body: QuotePdfFullPayload = {
        ...draft,
        quote: {
          ...draft.quote,
          quote_date: quoteDateIso,
          valid_until: validUntilIso,
          notes: draft.quote.notes.map((s) => s.trim()).filter(Boolean),
          terms: [],
        },
        summary: { ...draft.summary, ...jobTotals },
        pricing: {
          ...draft.pricing,
          total_price: subtotal,
          total_incl_vat: totalInclVat,
        },
        items: draft.items.map((it) => ({
          ...it,
          material_type: materialFamilyLabel,
          plate_shape: it.plate_shape ?? "flat",
          description: finalizePlateTypeLabel(it.plate_shape),
          thickness_mm: roundToMaxDecimals(it.thickness_mm, 3),
          width_mm: roundToMaxDecimals(it.width_mm, 3),
          length_mm: roundToMaxDecimals(it.length_mm, 3),
          area_m2: roundToMaxDecimals(it.area_m2, 3),
          weight_kg: roundToMaxDecimals(it.weight_kg, 3),
          line_total: roundToMaxDecimals(it.line_total, 3),
        })),
      };
      const res = await fetch("/api/quotes/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = (await res.json()) as { error?: string; hint?: string };
          if (j.error) msg = j.error;
          if (j.hint) msg = `${msg}\n${j.hint}`;
        } catch {
          try {
            msg = await res.text();
          } catch {
            /* keep */
          }
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotation-${draft.quote.quote_number.replace(/[^a-zA-Z0-9-_]+/g, "_")}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDraft((d) => ({
        ...d,
        quote: {
          ...d.quote,
          quote_date: quoteDateIso,
          valid_until: validUntilIso,
        },
      }));
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : t(`${FP}.exportFailed`));
    } finally {
      setExporting(false);
    }
  }, [
    draft,
    quoteDateDisplay,
    validUntilDisplay,
    materialFamilyLabel,
    setDraft,
  ]);

  const notesText = draft.quote.notes.join("\n");

  const exportPdfDisabled = exporting || draft.items.length === 0;

  const pv = previewPart;
  const previewTotalWeightLine = pv ? pv.weightKg * pv.qty : 0;
  const previewLineAreaM2 = pv ? pv.areaM2 * pv.qty : 0;
  const { finish: previewFinishLabel } = splitMaterialGradeAndFinish(
    pv?.material ?? ""
  );

  const headBase =
    "sticky top-0 z-30 py-2 pe-3 ps-3 text-xs font-medium align-middle whitespace-nowrap bg-card border-e border-border";
  const headStart = `${headBase} text-start`;
  const headNum = `${headBase} text-start tabular-nums`;
  const cellBase = "py-2 pe-3 ps-3 align-middle text-sm border-b border-border";
  const cellStart = `${cellBase} text-start min-w-0`;
  const cellNum = `${cellBase} text-start tabular-nums min-w-0`;

  async function copyQuoteNumberToClipboard() {
    const num = draft.quote.quote_number.trim();
    if (!num) return;
    try {
      await navigator.clipboard.writeText(num);
      setQuoteNumberCopied(true);
      window.setTimeout(() => setQuoteNumberCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-8 pb-12 pt-6 lg:pt-8" dir="rtl">
      {/* Top padding aligns with other quick-quote steps (main uses !pt-0 on step 7 for sticky thead). */}
      {/* No overflow-hidden on ds-surface: it breaks sticky table headers inside the scrollable PageContainer. */}
      <div className="ds-surface text-start">
        <div className="ds-surface-header flex flex-col gap-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {t(`${FP}.pageTitle`)}
              </h1>
              <Badge variant="secondary" className="shrink-0 font-normal">
                {t(`${FP}.badgeReviewExport`)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t(`${FP}.pageSubtitle`)}</p>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <Card className="border-border bg-card/40 text-start shadow-none" dir="rtl">
            <CardHeader className="space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-semibold">{t(`${FP}.quoteDetailsTitle`)}</CardTitle>
            </CardHeader>
            <CardContent className="max-w-md space-y-3 px-4 pb-5 pt-0">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t(`${FP}.quoteNumber`)}
                </p>
                <div className="flex max-w-md items-center gap-1.5">
                  <div
                    className="flex h-8 min-h-8 min-w-0 flex-1 max-w-[13rem] items-center justify-start rounded-md border border-border bg-muted/25 px-3 text-xs text-muted-foreground"
                    dir="rtl"
                  >
                    <bdi dir="ltr" className="tabular-nums">
                      {draft.quote.quote_number}
                    </bdi>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => void copyQuoteNumberToClipboard()}
                    aria-label={t(`${FP}.copyQuoteNumberAria`)}
                  >
                    {quoteNumberCopied ? (
                      <Check className="h-4 w-4 text-[#6A23F7]" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="space-y-1">
                  <Label htmlFor="q-date" className="text-[11px] text-muted-foreground">
                    {t(`${FP}.quoteDate`)}
                  </Label>
                  <Input
                    id="q-date"
                    dir="ltr"
                    autoComplete="off"
                    placeholder={t(`${FP}.dateInputPlaceholder`)}
                    className="h-8 w-full max-w-[11rem] bg-background/80 text-end text-xs tabular-nums"
                    value={quoteDateDisplay}
                    onChange={(e) => setQuoteDateDisplay(e.target.value)}
                    onBlur={() => {
                      const iso = parseDdMmYyyyToIso(quoteDateDisplay);
                      if (iso) {
                        setDraft((d) => ({
                          ...d,
                          quote: { ...d.quote, quote_date: iso },
                        }));
                        setQuoteDateDisplay(formatIsoToDdMmYyyy(iso));
                      } else {
                        setQuoteDateDisplay(
                          formatIsoToDdMmYyyy(draft.quote.quote_date)
                        );
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="q-valid" className="text-[11px] text-muted-foreground">
                    {t(`${FP}.validUntil`)}
                  </Label>
                  <Input
                    id="q-valid"
                    dir="ltr"
                    autoComplete="off"
                    placeholder={t(`${FP}.dateInputPlaceholder`)}
                    className="h-8 w-full max-w-[11rem] bg-background/80 text-end text-xs tabular-nums"
                    value={validUntilDisplay}
                    onChange={(e) => setValidUntilDisplay(e.target.value)}
                    onBlur={() => {
                      const iso = parseDdMmYyyyToIso(validUntilDisplay);
                      if (iso) {
                        setDraft((d) => ({
                          ...d,
                          quote: { ...d.quote, valid_until: iso },
                        }));
                        setValidUntilDisplay(formatIsoToDdMmYyyy(iso));
                      } else {
                        setValidUntilDisplay(
                          formatIsoToDdMmYyyy(draft.quote.valid_until)
                        );
                      }
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="q-cust" className="text-[11px] text-muted-foreground">
                  {t(`${FP}.customerName`)}
                </Label>
                <Input
                  id="q-cust"
                  dir="rtl"
                  className="h-8 w-full max-w-sm bg-background/80 text-start text-xs"
                  value={draft.quote.customer_name ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, customer_name: e.target.value || null },
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="q-proj" className="text-[11px] text-muted-foreground">
                  {t(`${FP}.projectName`)}
                </Label>
                <Input
                  id="q-proj"
                  dir="rtl"
                  className="h-8 w-full max-w-sm bg-background/80 text-start text-xs"
                  value={draft.quote.project_name ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, project_name: e.target.value || null },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Export above metrics; button on visual left (RTL: justify-end). */}
          <div dir="rtl" className="space-y-3 text-start">
            <div className="flex w-full justify-end">
              <Button
                type="button"
                size="default"
                className="min-w-[10rem] gap-1"
                disabled={exportPdfDisabled}
                onClick={() => void handleExportPdf()}
              >
                {exporting ? t(`${FP}.exporting`) : t(`${FP}.exportQuoteProduce`)}
                <FileDown className="ms-1.5 h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </div>
            <div className="overflow-hidden rounded-md border border-border bg-white/[0.08]">
              <div className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-5">
                <div className="bg-card">
                  <FinalizeSummaryMetricCard
                    icon={Layers}
                    title={t(`${PP}.cardPlateTypesLabel`)}
                    valueLine={<>{formatInteger(finalizeStripMetrics.plateTypes)}</>}
                  />
                </div>
                <div className="bg-card">
                  <FinalizeSummaryMetricCard
                    icon={Package}
                    title={t(`${PP}.cardPlateQtyLabel`)}
                    valueLine={<>{formatInteger(finalizeStripMetrics.totalQty)}</>}
                  />
                </div>
                <div className="bg-card">
                  <FinalizeSummaryMetricCard
                    icon={LayoutGrid}
                    title={t(`${PP}.cardAreaLabel`)}
                    valueLine={
                      <>
                        <span>{formatDecimal(finalizeStripMetrics.totalAreaM2, 2)}</span>
                        <span className={METRIC_UNIT_CLASS}>
                          {t("methodMetrics.unitM2")}
                        </span>
                      </>
                    }
                  />
                </div>
                <div className="bg-card">
                  <FinalizeSummaryMetricCard
                    icon={Weight}
                    title={t(`${PP}.cardWeightLabel`)}
                    valueLine={
                      <>
                        <span>{formatDecimal(finalizeStripMetrics.totalWeightKg, 1)}</span>
                        <span className={METRIC_UNIT_CLASS}>
                          {t("methodMetrics.unitKg")}
                        </span>
                      </>
                    }
                  />
                </div>
                <div className="bg-card">
                  <FinalizeSummaryMetricCard
                    glyph={
                      <span
                        className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center text-[1.2rem] font-semibold leading-none text-muted-foreground/70 sm:h-6 sm:text-[1.35rem]"
                        aria-hidden
                      >
                        ₪
                      </span>
                    }
                    title={t(`${FP}.cardQuotePriceLabel`)}
                    valueLine={
                      <>
                        <span>
                          {formatQuickQuoteCurrencyAmount(
                            draft.pricing.total_price,
                            FINALIZE_PRICE_CURRENCY
                          )}
                        </span>
                        <span className={METRIC_UNIT_CLASS}>
                          {quickQuoteCurrencySymbol(FINALIZE_PRICE_CURRENCY)}
                        </span>
                      </>
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <Card dir="rtl" className="text-start">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 px-4 pb-3 pt-0 sm:px-6">
              <CardTitle className="text-base">{t(`${FP}.plateDetailTableTitle`)}</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={resetPricingToCalculated}
                aria-label={t(`${FP}.resetLinePricingAria`)}
              >
                {t(`${FP}.resetLinePricing`)}
              </Button>
            </CardHeader>
            <CardContent className="px-0 sm:px-0">
              {/* No overflow-* on wrappers here — sticky `th` must stick to the page scroll like PartBreakdownTable. */}
              <div className="px-4 pb-4 sm:px-6">
                <div className="rounded-md border border-border bg-card">
                  <Table
                    dir="rtl"
                    containerClassName="overflow-visible"
                    className={cn(
                      "table-fixed border-separate border-spacing-0 text-start",
                      "min-w-[1180px] w-full",
                      "[&_th]:text-start [&_td]:text-start"
                    )}
                  >
                    <colgroup>
                      {plateTableColWidths.map((pct, i) => (
                        <col key={i} style={{ width: `${pct}%` }} />
                      ))}
                    </colgroup>
                    <TableHeader className="relative z-30 border-b border-border bg-card shadow-[0_1px_0_0_hsl(var(--border))] [&_th]:bg-card [&_tr]:border-b-0">
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
                          className={cn(headBase, "min-w-[3.5rem] text-center")}
                        >
                          {t(`${FP}.colCorrugated`)}
                        </TableHead>
                        <TableHead scope="col" className={headNum}>
                          {t(`${FP}.colPrice`)}
                        </TableHead>
                        <TableHead
                          scope="col"
                          className={cn(headBase, "min-w-[4.5rem] text-center")}
                        >
                          {t(`${FP}.colView`)}
                        </TableHead>
                        <TableHead
                          scope="col"
                          className={cn(headBase, "border-e-0 text-center")}
                        >
                          <span className="sr-only">{t(`${FP}.colDelete`)}</span>
                          <span aria-hidden className="text-muted-foreground">
                            {t(`${FP}.colDelete`)}
                          </span>
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
                            <span
                              className="block min-w-0 truncate px-0.5 py-1.5 text-sm font-medium text-foreground"
                              title={finalizePlateTypeLabel(row.plate_shape)}
                            >
                              {finalizePlateTypeLabel(row.plate_shape)}
                            </span>
                          </TableCell>
                          <TableCell className={cn(cellStart, "border-e border-border")}>
                            <Input
                              className={FINALIZE_CELL_INPUT}
                              dir="rtl"
                              value={row.part_number}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  items: d.items.map((it, j) =>
                                    j === i ? { ...it, part_number: e.target.value } : it
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className={cn(cellNum, "border-e border-border")}>
                            <Input
                              className={cn(FINALIZE_CELL_INPUT, "text-start")}
                              inputMode="numeric"
                              type="number"
                              step={1}
                              min={0}
                              value={row.qty}
                              onChange={(e) => {
                                const v = Math.max(0, int(e.target.value, row.qty));
                                applyPartRowPatch(i, { qty: v }, true);
                              }}
                            />
                          </TableCell>
                          <TableCell className={cn(cellNum, "border-e border-border")}>
                            <Input
                              className={cn(FINALIZE_CELL_INPUT, "text-start")}
                              inputMode="decimal"
                              type="number"
                              step="0.001"
                              value={roundToMaxDecimals(row.thickness_mm, 3)}
                              onChange={(e) => {
                                const v =
                                  e.target.value === ""
                                    ? 0
                                    : num(e.target.value, row.thickness_mm);
                                applyPartRowPatch(
                                  i,
                                  { thickness_mm: roundToMaxDecimals(v, 3) },
                                  true
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell className={cn(cellNum, "border-e border-border")}>
                            <Input
                              className={cn(FINALIZE_CELL_INPUT, "text-start")}
                              inputMode="decimal"
                              type="number"
                              step="0.001"
                              value={roundToMaxDecimals(row.length_mm, 3)}
                              onChange={(e) => {
                                const v =
                                  e.target.value === ""
                                    ? 0
                                    : num(e.target.value, row.length_mm);
                                applyPartRowPatch(
                                  i,
                                  { length_mm: roundToMaxDecimals(v, 3) },
                                  true
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell className={cn(cellNum, "border-e border-border")}>
                            <Input
                              className={cn(FINALIZE_CELL_INPUT, "text-start")}
                              inputMode="decimal"
                              type="number"
                              step="0.001"
                              value={roundToMaxDecimals(row.width_mm, 3)}
                              onChange={(e) => {
                                const v =
                                  e.target.value === ""
                                    ? 0
                                    : num(e.target.value, row.width_mm);
                                applyPartRowPatch(
                                  i,
                                  { width_mm: roundToMaxDecimals(v, 3) },
                                  true
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell
                            className={cn(
                              cellNum,
                              "border-e border-border text-xs text-muted-foreground"
                            )}
                          >
                            {formatUpTo3Decimals(row.area_m2)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              cellNum,
                              "border-e border-border text-xs text-muted-foreground"
                            )}
                          >
                            {formatUpTo3Decimals(row.weight_kg)}
                          </TableCell>
                          <TableCell className={cn(cellStart, "border-e border-border")}>
                            <Input
                              className={FINALIZE_CELL_INPUT}
                              dir="rtl"
                              value={row.material_grade}
                              onChange={(e) =>
                                applyPartRowPatch(i, { material_grade: e.target.value }, true)
                              }
                            />
                          </TableCell>
                          <TableCell className={cn(cellStart, "border-e border-border")}>
                            <Input
                              className={FINALIZE_CELL_INPUT}
                              dir="rtl"
                              value={row.finish}
                              onChange={(e) =>
                                applyPartRowPatch(i, { finish: e.target.value }, true)
                              }
                            />
                          </TableCell>
                          <TableCell
                            className={cn(cellBase, "border-e border-border text-center")}
                          >
                            {isFinalizeBendPlateRowShape(row.plate_shape) ? (
                              <div className="flex justify-center py-1">
                                <OptimisticCheckbox
                                  checked={row.corrugated === true}
                                  aria-label={t(`${FP}.ariaCorrugatedRow`, {
                                    name: row.part_number || String(i + 1),
                                  })}
                                  onCheckedChange={(v) =>
                                    applyPartRowPatch(i, { corrugated: v }, false)
                                  }
                                />
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              cellNum,
                              "border-e border-border font-medium text-foreground"
                            )}
                          >
                            <Input
                              key={`line-price-${i}-${row.line_total}-${linePriceResetNonce}`}
                              id={`line-price-${i}`}
                              inputMode="decimal"
                              autoComplete="off"
                              className={cn(
                                FINALIZE_CELL_INPUT,
                                "h-8 text-end text-xs tabular-nums"
                              )}
                              dir="ltr"
                              defaultValue={formatDecimal(row.line_total, 2)}
                              onBlur={(e) => {
                                const raw = e.target.value.trim().replace(/,/g, "");
                                const parsed =
                                  raw === ""
                                    ? 0
                                    : Math.max(0, num(raw, row.line_total));
                                applyLineTotalPatch(
                                  i,
                                  roundToMaxDecimals(parsed, 2)
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell
                            className={cn(
                              cellBase,
                              "border-e border-border text-center"
                            )}
                          >
                            <button
                              type="button"
                              aria-label={t(`${FP}.ariaPreviewRow`, {
                                name: row.part_number || String(i + 1),
                              })}
                              onClick={() => openPreviewForRow(row, i)}
                              className={cn(
                                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                                PREVIEW_ICON_CLASS,
                                "hover:bg-white/5",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                              )}
                            >
                              <Eye
                                className="h-4 w-4"
                                stroke={PREVIEW_STROKE}
                                strokeWidth={2}
                                aria-hidden
                              />
                            </button>
                          </TableCell>
                          <TableCell className={cn(cellBase, "border-e-0 text-center")}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                              disabled={draft.items.length <= 1}
                              aria-label={t(`${FP}.ariaDeleteRow`, {
                                name: row.part_number || String(i + 1),
                              })}
                              onClick={() => removeFinalizeRow(i)}
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

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
                          dxfGeometries={dxfPartGeometries}
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

          <Card dir="rtl" className="text-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t(`${FP}.pricingSummaryTitle`)}</CardTitle>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pr-subtotal">{t(`${FP}.quoteBeforeVatLabel`)}</Label>
                  <Input
                    id="pr-subtotal"
                    inputMode="decimal"
                    placeholder="0"
                    className="h-9 w-full tabular-nums text-end"
                    dir="ltr"
                    value={subtotalField}
                    onChange={(e) => setSubtotalField(e.target.value)}
                    onBlur={() => {
                      const raw = subtotalField.trim().replace(/,/g, "");
                      const parsed = raw === "" ? 0 : Math.max(0, num(raw, 0));
                      const subtotal = roundToMaxDecimals(parsed, 2);
                      setSubtotalField(formatDecimal(subtotal, 2));
                      setDraft((d) => ({
                        ...d,
                        pricing: {
                          ...d.pricing,
                          total_price: subtotal,
                          total_incl_vat: computeQuoteTotalInclVat(
                            subtotal,
                            d.pricing.discount,
                            d.pricing.vat_rate
                          ),
                        },
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pr-disc">{t(`${FP}.discountOptional`)}</Label>
                  <Input
                    id="pr-disc"
                    inputMode="decimal"
                    placeholder="—"
                    className="tabular-nums text-start"
                    dir="ltr"
                    value={draft.pricing.discount ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      setDraft((d) => {
                        const discount = raw === "" ? null : Math.max(0, num(raw, 0));
                        const subtotal = d.pricing.total_price;
                        return {
                          ...d,
                          pricing: {
                            ...d.pricing,
                            discount,
                            total_incl_vat: computeQuoteTotalInclVat(
                              subtotal,
                              discount,
                              d.pricing.vat_rate
                            ),
                          },
                        };
                      });
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-vat" className="text-muted-foreground">
                  {t(`${FP}.vatLabel`, {
                    pct: Math.round(draft.pricing.vat_rate * 100),
                  })}
                </Label>
                <div
                  id="pr-vat"
                  className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground"
                  aria-readonly
                  dir="ltr"
                >
                  <span className="min-w-0 flex-1 text-end">
                    {formatDecimal(
                      computeVatAmount(
                        computeNetBeforeVat(draft.pricing.total_price, draft.pricing.discount),
                        draft.pricing.vat_rate
                      ),
                      2
                    )}
                  </span>
                  <span className="shrink-0 font-medium text-muted-foreground" aria-hidden>
                    ₪
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-incl">{t(`${FP}.totalInclVat`)}</Label>
                <div
                  id="pr-incl"
                  className="flex h-10 w-full items-center justify-between gap-2 rounded-[10px] border border-border bg-white/[0.04] px-3 text-base font-semibold tabular-nums text-foreground"
                  aria-readonly
                  dir="ltr"
                >
                  <span className="min-w-0 flex-1 text-end">
                    {formatDecimal(
                      computeQuoteTotalInclVat(
                        draft.pricing.total_price,
                        draft.pricing.discount,
                        draft.pricing.vat_rate
                      ),
                      2
                    )}
                  </span>
                  <span className="shrink-0 text-muted-foreground" aria-hidden>
                    ₪
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card dir="rtl" className="text-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t(`${FP}.notesTitle`)}</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-start">
              <div className="w-full max-w-xl">
                <Textarea
                  rows={6}
                  dir="rtl"
                  className="min-h-[9rem] w-full text-start"
                  placeholder={t(`${FP}.notesPlaceholder`)}
                  value={notesText}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: {
                        ...d.quote,
                        notes: e.target.value.split("\n"),
                      },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
