"use client";

import { useMemo } from "react";
import {
  Factory,
  FileCode,
  FileDown,
  FileSpreadsheet,
  MoveHorizontal,
  MoveVertical,
  Square,
  Weight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  computeAreaMetric,
  computeLengthMetric,
  computeMaterialMetric,
  computeWeightMetric,
  computeWidthMetric,
  type CompareMetricResult,
} from "../lib/excelDxfCompareAggregates";
import { ValidationTable } from "./ValidationTable";
import type { ValidationRow, ValidationSummary } from "../types/quickQuote";

export interface DxfExcelCompareScreenProps {
  summary: ValidationSummary;
  rows: ValidationRow[];
  /** Excel comparison export (DXF quote method — same action as former header control). */
  onExportXlsx?: () => void;
  exportXlsxDisabled?: boolean;
}

/**
 * Full-panel Excel vs DXF comparison (DXF quote method review step — replaces modal).
 */
export function DxfExcelCompareScreen({
  summary,
  rows,
  onExportXlsx,
  exportXlsxDisabled = false,
}: DxfExcelCompareScreenProps) {
  const metrics = useMemo(
    () => ({
      length: computeLengthMetric(rows),
      width: computeWidthMetric(rows),
      weight: computeWeightMetric(rows),
      area: computeAreaMetric(rows),
      material: computeMaterialMetric(rows),
    }),
    [rows]
  );

  return (
    <div className="mt-3 min-w-0 w-full rounded-xl border border-white/10 bg-card sm:mt-4">
      {/* Scrolls with the DXF phase panel — not a separate sticky band */}
      <div className="border-b border-white/10 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-pretty text-lg font-semibold leading-snug text-foreground sm:text-xl">
              {t("quote.dxfPhase.excelDxfCompare.title")}
            </h2>
            <span
              className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/[0.14] px-3 py-1 text-xs font-medium text-primary/90 dark:text-primary/80"
              role="status"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_0_2px_rgb(106_35_247/0.35)]"
                aria-hidden
              />
              {t("quote.dxfPhase.excelDxfCompare.rowsCheckedLine", {
                n: formatInteger(summary.totalRows),
              })}
            </span>
          </div>
          {onExportXlsx ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 [color-scheme:dark]"
              disabled={exportXlsxDisabled}
              onClick={() => onExportXlsx()}
            >
              <FileDown className="h-4 w-4 shrink-0" aria-hidden />
              {t("quote.dxfPhase.excelDxfCompare.exportXlsx")}
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
          {t("quote.dxfPhase.excelDxfCompare.description")}
        </p>
      </div>

      <div className="min-w-0 space-y-6 px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
        <TooltipProvider delayDuration={350}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <CompareMetricCard
              variant="length"
              icon={MoveHorizontal}
              label={t("quote.dxfPhase.excelDxfCompare.metricLength")}
              result={metrics.length}
              rows={rows}
              contextMsgKey="quote.dxfPhase.excelDxfCompare.deviationContextLength"
            />
            <CompareMetricCard
              variant="width"
              icon={MoveVertical}
              label={t("quote.dxfPhase.excelDxfCompare.metricWidth")}
              result={metrics.width}
              rows={rows}
              contextMsgKey="quote.dxfPhase.excelDxfCompare.deviationContextWidth"
            />
            <CompareMetricCard
              variant="weight"
              icon={Weight}
              label={t("quote.dxfPhase.excelDxfCompare.metricWeight")}
              result={metrics.weight}
              rows={rows}
              contextMsgKey="quote.dxfPhase.excelDxfCompare.deviationContextWeight"
            />
            <CompareMetricCard
              variant="area"
              icon={Square}
              label={t("quote.dxfPhase.excelDxfCompare.metricArea")}
              result={metrics.area}
              rows={rows}
              contextMsgKey="quote.dxfPhase.excelDxfCompare.deviationContextArea"
            />
            <CompareMetricCard
              variant="material"
              icon={Factory}
              label={t("quote.dxfPhase.excelDxfCompare.metricMaterial")}
              result={metrics.material}
              rows={rows}
              nonAggregateMismatchKey="quote.dxfPhase.excelDxfCompare.materialMismatchDetail"
            />
          </div>
        </TooltipProvider>

        <ValidationTable rows={rows} />
      </div>
    </div>
  );
}

type CompareMetricVariant = "length" | "width" | "weight" | "area" | "material";

function compareMetricTooltipTitleKey(variant: CompareMetricVariant): string {
  const m = "quote.dxfPhase.excelDxfCompare";
  switch (variant) {
    case "length":
      return `${m}.cardTooltipTitleLength`;
    case "width":
      return `${m}.cardTooltipTitleWidth`;
    case "weight":
      return `${m}.cardTooltipTitleWeight`;
    case "area":
      return `${m}.cardTooltipTitleArea`;
    case "material":
      return `${m}.cardTooltipTitleMaterial`;
  }
}

function CompareTooltipColumnHeader({
  icon: Icon,
  label,
  withEndBorder,
}: {
  icon: LucideIcon;
  label: string;
  withEndBorder?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 px-3 py-2.5 text-center font-semibold text-muted-foreground",
        withEndBorder && "border-e border-white/10"
      )}
    >
      <Icon className="size-[1.15em] shrink-0 opacity-80" aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}

/** Unit first (visual left), then number — avoids bidi flipping Hebrew units in RTL. */
function TooltipNumericValueCell({ unit, value }: { unit: string; value: string }) {
  return (
    <div
      className="flex flex-row items-center justify-center gap-2 px-3 py-3 tabular-nums text-white"
      dir="ltr"
    >
      <span className="shrink-0 text-white">{unit}</span>
      <span className="min-w-0 text-white">{value}</span>
    </div>
  );
}

const NUMERIC_TOOLTIP_DELTA_EPS = 1e-9;

type TooltipMetricTotalCell = { unit: string; value: string };

function formatMetricTotalsForTooltip(
  variant: CompareMetricVariant,
  result: CompareMetricResult
): { excel: TooltipMetricTotalCell; dxf: TooltipMetricTotalCell } | null {
  if (variant === "material") return null;
  const { excelTotal: e, dxfTotal: d } = result;
  switch (variant) {
    case "length":
    case "width":
      return {
        excel: { unit: "מ״מ", value: formatInteger(e) },
        dxf: { unit: "מ״מ", value: formatInteger(d) },
      };
    case "weight":
      return {
        excel: { unit: "ק״ג", value: formatDecimal(e, 2) },
        dxf: { unit: "ק״ג", value: formatDecimal(d, 2) },
      };
    case "area":
      return {
        excel: { unit: "מ״ר", value: formatDecimal(e, 4) },
        dxf: { unit: "מ״ר", value: formatDecimal(d, 4) },
      };
    default:
      return null;
  }
}

type NumericCompareVariant = Exclude<CompareMetricVariant, "material">;

function formatDeltaForTooltip(variant: NumericCompareVariant, delta: number): string {
  switch (variant) {
    case "length":
    case "width":
      return formatInteger(Math.round(delta));
    case "weight":
      return formatDecimal(delta, 2);
    case "area":
      return formatDecimal(delta, 4);
  }
}

function variantAnalysisSuffix(variant: NumericCompareVariant): string {
  switch (variant) {
    case "length":
      return "Length";
    case "width":
      return "Width";
    case "weight":
      return "Weight";
    case "area":
      return "Area";
  }
}

function numericTooltipAnalysisText(
  msgBase: string,
  variant: NumericCompareVariant,
  result: CompareMetricResult
): string {
  const e = result.excelTotal;
  const d = result.dxfTotal;
  if (e === 0 && d === 0) {
    return t(`${msgBase}.cardTooltipAnalysisNoData`);
  }
  const delta = Math.abs(e - d);
  if (delta < NUMERIC_TOOLTIP_DELTA_EPS) {
    return t(`${msgBase}.cardTooltipAnalysisNoDelta`);
  }
  const deltaStr = formatDeltaForTooltip(variant, delta);
  const excelHigher = e > d;
  const key = `${msgBase}.cardTooltipAnalysis${excelHigher ? "Excel" : "Dxf"}Higher${variantAnalysisSuffix(variant)}`;
  return t(key, { delta: deltaStr });
}

function CompareMetricCard({
  variant,
  icon: Icon,
  label,
  result,
  rows,
  contextMsgKey,
  nonAggregateMismatchKey,
}: {
  variant: CompareMetricVariant;
  icon: LucideIcon;
  label: string;
  result: CompareMetricResult;
  rows: ValidationRow[];
  contextMsgKey?: string;
  nonAggregateMismatchKey?: string;
}) {
  const m = "quote.dxfPhase.excelDxfCompare";
  const valueLabel = result.matches
    ? t(`${m}.statusMatch`)
    : t(`${m}.statusMismatch`);

  const showAggregateDeviation =
    !result.matches && (result.excelTotal > 0 || result.dxfTotal > 0);

  const detailText = !result.matches
    ? showAggregateDeviation && contextMsgKey
      ? t(`${m}.deviationDetail`, {
          pct: result.deviationPercent,
          context: t(contextMsgKey),
        })
      : nonAggregateMismatchKey
        ? t(nonAggregateMismatchKey)
        : t(`${m}.metricRowHint`)
    : null;

  const totals = formatMetricTotalsForTooltip(variant, result);
  const materialMismatchRows = rows.filter((r) =>
    r.mismatchFields.includes("Material")
  ).length;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card
          className={cn(
            "cursor-help border-white/[0.1] bg-gradient-to-b from-card to-card/80 shadow-sm transition-colors hover:bg-white/[0.04]",
            result.matches
              ? "ring-1 ring-primary/20 hover:ring-primary/35"
              : "ring-1 ring-amber-500/30 bg-amber-500/[0.03] hover:ring-amber-500/45"
          )}
        >
          <CardContent className="flex min-h-[12.5rem] flex-col items-center justify-center gap-3 p-4 text-center">
            <div
              className={cn(
                "flex size-[calc(2.75rem/1.5)] shrink-0 items-center justify-center rounded-lg",
                result.matches ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-500"
              )}
            >
              <Icon
                className="size-[calc(1.25rem/1.5)]"
                strokeWidth={1.75}
                aria-hidden
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p
              className={cn(
                "text-base font-bold tabular-nums",
                result.matches ? "text-primary" : "text-amber-500"
              )}
            >
              {valueLabel}
            </p>
            {result.matches || detailText ? (
              <p className="max-w-[14rem] text-pretty text-xs leading-relaxed text-muted-foreground">
                {result.matches ? t(`${m}.analysisMatch`) : detailText}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="max-w-[24rem] border-white/15 bg-popover px-5 py-4 text-center text-sm leading-relaxed shadow-lg"
        dir="ltr"
      >
        <div className="mx-auto flex w-full max-w-full flex-col items-center justify-center gap-3 text-center">
          <p
            dir="rtl"
            className="w-full text-center font-semibold leading-snug text-foreground"
          >
            {t(compareMetricTooltipTitleKey(variant))}
          </p>
          {variant === "material" ? (
            <>
              <div dir="ltr" className="w-full overflow-hidden rounded-md border border-white/10 leading-tight">
                <div className="grid grid-cols-2 bg-muted/40">
                  <CompareTooltipColumnHeader
                    icon={FileCode}
                    label={t(`${m}.cardTooltipColDxf`)}
                    withEndBorder
                  />
                  <CompareTooltipColumnHeader
                    icon={FileSpreadsheet}
                    label={t(`${m}.cardTooltipColExcel`)}
                  />
                </div>
                <div className="grid grid-cols-2 divide-x divide-white/10 bg-popover/90">
                  <div
                    dir="rtl"
                    className="flex items-center justify-center px-3 py-3 text-center text-white"
                  >
                    {t(`${m}.cardTooltipMaterialColDxfHint`)}
                  </div>
                  <div
                    dir="rtl"
                    className="flex items-center justify-center px-3 py-3 text-center text-white"
                  >
                    {t(`${m}.cardTooltipMaterialColExcelHint`)}
                  </div>
                </div>
              </div>
              <p
                dir="rtl"
                className="w-full border-t border-white/10 pt-3 text-pretty text-center leading-relaxed text-white"
              >
                {materialMismatchRows === 0
                  ? t(`${m}.cardTooltipMaterialAnalysisAllMatch`)
                  : t(`${m}.cardTooltipMaterialAnalysisSomeMismatch`, {
                      total: formatInteger(rows.length),
                      mismatch: formatInteger(materialMismatchRows),
                    })}
              </p>
            </>
          ) : totals ? (
            <>
              <div dir="ltr" className="w-full overflow-hidden rounded-md border border-white/10 leading-tight">
                <div className="grid grid-cols-2 bg-muted/40">
                  <CompareTooltipColumnHeader
                    icon={FileCode}
                    label={t(`${m}.cardTooltipColDxf`)}
                    withEndBorder
                  />
                  <CompareTooltipColumnHeader
                    icon={FileSpreadsheet}
                    label={t(`${m}.cardTooltipColExcel`)}
                  />
                </div>
                <div className="grid grid-cols-2 divide-x divide-white/10 bg-popover/90">
                  <TooltipNumericValueCell unit={totals.dxf.unit} value={totals.dxf.value} />
                  <TooltipNumericValueCell unit={totals.excel.unit} value={totals.excel.value} />
                </div>
              </div>
              <p
                dir="rtl"
                className="w-full border-t border-white/10 pt-3 text-pretty text-center leading-relaxed text-white"
              >
                {numericTooltipAnalysisText(m, variant, result)}
              </p>
            </>
          ) : (
            <p
              dir="rtl"
              className="w-full text-pretty text-center leading-relaxed text-muted-foreground"
            >
              {t(`${m}.metricRowHint`)}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
