"use client";

import { useMemo } from "react";
import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  QuotePartRow,
  ThicknessStockInput,
} from "../../types/quickQuote";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { t } from "@/lib/i18n";
import { buildJobOverview } from "../jobOverview.utils";
import { JobOverviewCard } from "./JobOverviewCard";
import { MetricBatchStrip } from "./MetricBatchStrip";

const QA = "quote.quantityAnalysis" as const;

interface JobOverviewSectionProps {
  jobSummary: JobSummaryMetrics;
  mfgParams: ManufacturingParameters;
  parts: QuotePartRow[];
  thicknessStock?: ThicknessStockInput[] | null;
}

/** Value only — unit is shown in the card title (Phase 5 metric strips). */
function formatWeightValueOnly(kg: number): string {
  const k = Math.max(0, Number.isFinite(kg) ? kg : 0);
  return k.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

function formatAreaValueOnly(m2: number, fractionDigits = 2): string {
  const a = Math.max(0, Number.isFinite(m2) ? m2 : 0);
  return a.toLocaleString("he-IL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatCutLengthValueOnly(mm: number): string {
  const m = Math.max(0, Number.isFinite(mm) ? mm : 0) / 1000;
  return m.toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function JobOverviewSection({
  jobSummary,
  mfgParams,
  parts,
  thicknessStock,
}: JobOverviewSectionProps) {
  const model = useMemo(
    () =>
      buildJobOverview({ jobSummary, mfgParams, parts, thicknessStock }),
    [jobSummary, mfgParams, parts, thicknessStock]
  );

  const stockWeightKg = useMemo(() => {
    const net = model.netPlateAreaM2;
    if (net <= 0 || !Number.isFinite(net)) return 0;
    return (model.grossMaterialAreaM2 / net) * model.totalWeightKg;
  }, [model]);

  const scrapPct =
    model.grossMaterialAreaM2 > 0
      ? (model.wasteAreaM2 / model.grossMaterialAreaM2) * 100
      : 0;

  const sheetsSub =
    model.estimatedSheetCount === 1
      ? t(`${QA}.metricStockSheetsSubOne`)
      : t(`${QA}.metricStockSheetsSubMany`, {
          n: formatInteger(model.estimatedSheetCount),
        });

  const customerItems = useMemo(
    () => [
      {
        title: t(`${QA}.metricPlateTypes`),
        value: formatInteger(model.totalParts),
        subtext: t(`${QA}.metricPlateTypesSub`),
      },
      {
        title: t(`${QA}.metricPlateQty`),
        value: formatInteger(model.totalPlates),
        subtext: t(`${QA}.metricPlateQtySub`),
      },
      {
        title: t(`${QA}.metricDemandArea`),
        value: formatAreaValueOnly(model.netPlateAreaM2),
        subtext: t(`${QA}.metricDemandAreaSub`),
      },
      {
        title: t(`${QA}.metricDemandWeight`),
        value: formatWeightValueOnly(model.totalWeightKg),
        subtext: t(`${QA}.metricDemandWeightSub`),
      },
    ],
    [model]
  );

  const stockItems = useMemo(
    () => [
      {
        title: t(`${QA}.metricStockArea`),
        value: formatAreaValueOnly(model.grossMaterialAreaM2),
        subtext: t(`${QA}.metricStockAreaSub`),
      },
      {
        title: t(`${QA}.metricStockWeight`),
        value: formatWeightValueOnly(stockWeightKg),
        subtext: t(`${QA}.metricStockWeightSub`),
      },
      {
        title: t(`${QA}.metricStockSheets`),
        value: formatInteger(model.estimatedSheetCount),
        subtext: sheetsSub,
      },
      {
        title: t(`${QA}.metricCutLengthReq`),
        value: formatCutLengthValueOnly(model.totalCutLengthMm),
        subtext: t(`${QA}.metricCutLengthReqSub`),
      },
    ],
    [model, sheetsSub, stockWeightKg]
  );

  return (
    <section className="space-y-8" dir="rtl">
      <MetricBatchStrip
        sectionTitle={t(`${QA}.batchCustomerTitle`)}
        items={customerItems}
      />

      <MetricBatchStrip
        sectionTitle={t(`${QA}.batchStockTitle`)}
        items={stockItems}
      />

      <div className="space-y-3">
        <h3 className="text-start text-sm font-semibold text-foreground">
          {t(`${QA}.batchAnalysisTitle`)}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <JobOverviewCard
            title={t(`${QA}.metricUtilizationPct`)}
            value={`${formatDecimal(model.utilizationPct, 1)}%`}
            subtext={t(`${QA}.metricUtilizationPctSub`)}
            highlight="emerald"
          />
          <JobOverviewCard
            title={t(`${QA}.metricScrapPct`)}
            value={`${formatDecimal(scrapPct, 1)}%`}
            subtext={t(`${QA}.metricScrapPctSub`)}
            highlight="rose"
          />
        </div>
      </div>
    </section>
  );
}
