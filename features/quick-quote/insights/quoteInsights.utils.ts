import type { JobSummaryMetrics, ManufacturingParameters, PricingSummary } from "../types/quickQuote";
import {
  INSIGHTS_BAR_FILLS,
  INSIGHTS_CHART_MARGIN_STEP,
  INSIGHTS_DEFAULT_MARGIN_FALLBACK,
  INSIGHTS_MARGIN_MAX,
  INSIGHTS_MARGIN_MIN,
} from "./quoteInsights.mock";
import type {
  CostBreakdownRow,
  LargestCostInfo,
  MarginCurvePoint,
  QuoteCostInputs,
  QuoteInsightsDerived,
  ShareBreakdown,
} from "./quoteInsights.types";

export function safeNumber(n: unknown, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return n;
}

export function clampMargin(percent: number): number {
  const n = safeNumber(percent, INSIGHTS_DEFAULT_MARGIN_FALLBACK);
  return Math.min(INSIGHTS_MARGIN_MAX, Math.max(INSIGHTS_MARGIN_MIN, n));
}

export function extractQuoteCostInputs(pricing: PricingSummary): QuoteCostInputs {
  return {
    materialCost: safeNumber(pricing.materialCost),
    cuttingCost: safeNumber(pricing.cuttingCost),
    piercingCost: safeNumber(pricing.piercingCost),
    setupCost: safeNumber(pricing.setupCost),
    overheadCost: safeNumber(pricing.overhead),
  };
}

export function buildBaseCost(inputs: QuoteCostInputs): number {
  const sum =
    safeNumber(inputs.materialCost) +
    safeNumber(inputs.cuttingCost) +
    safeNumber(inputs.piercingCost) +
    safeNumber(inputs.setupCost) +
    safeNumber(inputs.overheadCost);
  return Math.max(0, sum);
}

export function buildProfit(baseCost: number, marginPercent: number): number {
  const b = Math.max(0, safeNumber(baseCost));
  const m = clampMargin(marginPercent);
  return (b * m) / 100;
}

/** Final selling price = base cost + margin on base. */
export function buildFinalQuotePrice(baseCost: number, marginPercent: number): number {
  const b = Math.max(0, safeNumber(baseCost));
  return b + buildProfit(b, marginPercent);
}

export function buildPricePerKg(
  finalQuotePrice: number,
  totalWeightKg: number
): { pricePerKg: number; unavailable: boolean } {
  const w = safeNumber(totalWeightKg);
  const f = Math.max(0, safeNumber(finalQuotePrice));
  if (w <= 0) return { pricePerKg: 0, unavailable: true };
  return { pricePerKg: f / w, unavailable: false };
}

export function buildMarginChartData(
  baseCost: number,
  minPercent = INSIGHTS_MARGIN_MIN,
  maxPercent = INSIGHTS_MARGIN_MAX,
  step = INSIGHTS_CHART_MARGIN_STEP
): MarginCurvePoint[] {
  const b = Math.max(0, safeNumber(baseCost));
  const out: MarginCurvePoint[] = [];
  const s = Math.max(1, step);
  for (let m = minPercent; m <= maxPercent; m += s) {
    const profit = buildProfit(b, m);
    out.push({
      marginPercent: m,
      finalQuotePrice: b + profit,
      profitAmount: profit,
    });
  }
  if (out.length === 0 || out[out.length - 1].marginPercent < maxPercent) {
    const profit = buildProfit(b, maxPercent);
    out.push({
      marginPercent: maxPercent,
      finalQuotePrice: b + profit,
      profitAmount: profit,
    });
  }
  return out;
}

export function buildCostBreakdownData(
  inputs: QuoteCostInputs,
  profitAmount: number
): CostBreakdownRow[] {
  const rows: CostBreakdownRow[] = [
    { key: "material", label: "Material", value: safeNumber(inputs.materialCost), fill: INSIGHTS_BAR_FILLS[0] },
    { key: "cutting", label: "Cutting", value: safeNumber(inputs.cuttingCost), fill: INSIGHTS_BAR_FILLS[1] },
    { key: "piercing", label: "Piercing", value: safeNumber(inputs.piercingCost), fill: INSIGHTS_BAR_FILLS[2] },
    { key: "setup", label: "Setup", value: safeNumber(inputs.setupCost), fill: INSIGHTS_BAR_FILLS[3] },
    { key: "overhead", label: "Overhead", value: safeNumber(inputs.overheadCost), fill: INSIGHTS_BAR_FILLS[4] },
    { key: "margin", label: "Profit / margin", value: Math.max(0, safeNumber(profitAmount)), fill: INSIGHTS_BAR_FILLS[5] },
  ];
  return rows;
}

export function processingCostFromInputs(inputs: QuoteCostInputs): number {
  return (
    safeNumber(inputs.cuttingCost) +
    safeNumber(inputs.piercingCost) +
    safeNumber(inputs.setupCost)
  );
}

export function buildShareBreakdown(
  inputs: QuoteCostInputs,
  profitAmount: number,
  finalQuotePrice: number
): ShareBreakdown {
  const final = Math.max(1e-9, safeNumber(finalQuotePrice));
  const material = safeNumber(inputs.materialCost);
  const processing = processingCostFromInputs(inputs);
  const profit = Math.max(0, safeNumber(profitAmount));
  return {
    materialShare: material / final,
    processingShare: processing / final,
    marginShare: profit / final,
  };
}

export function findLargestCostComponent(rows: CostBreakdownRow[]): LargestCostInfo {
  if (rows.length === 0) {
    return { key: "none", label: "—", value: 0 };
  }
  let best = rows[0];
  for (const r of rows) {
    if (r.value > best.value) best = r;
  }
  return { key: best.key, label: best.label, value: best.value };
}

export function deriveInsights(
  inputs: QuoteCostInputs,
  marginPercent: number,
  jobSummary: JobSummaryMetrics
): QuoteInsightsDerived {
  const baseCost = buildBaseCost(inputs);
  const profitAmount = buildProfit(baseCost, marginPercent);
  const finalQuotePrice = buildFinalQuotePrice(baseCost, marginPercent);
  const { pricePerKg, unavailable } = buildPricePerKg(
    finalQuotePrice,
    jobSummary.totalEstWeightKg
  );
  return {
    baseCost,
    profitAmount,
    finalQuotePrice,
    pricePerKg,
    pricePerKgUnavailable: unavailable,
  };
}

export function defaultMarginPercentFromMfg(mfg: ManufacturingParameters): number {
  return clampMargin(safeNumber(mfg.profitMarginPct, INSIGHTS_DEFAULT_MARGIN_FALLBACK));
}

export function formatPercentDisplay(ratio: number, fractionDigits = 0): string {
  if (!Number.isFinite(ratio) || ratio < 0) return "0%";
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
}

export function formatKgDisplay(kg: number): string {
  const k = safeNumber(kg);
  if (k <= 0) return "—";
  return `${k.toFixed(1)} kg`;
}

/**
 * Primary insight line + optional comparison vs the quote default margin %.
 */
export function buildDynamicInsightLines(
  currentMargin: number,
  defaultMargin: number,
  baseCost: number,
  formatCurrency: (n: number) => string
): string[] {
  const m = clampMargin(currentMargin);
  const profit = buildProfit(baseCost, m);
  const finalP = buildFinalQuotePrice(baseCost, m);
  const lines: string[] = [
    `At ${m}% margin, estimated profit is ${formatCurrency(profit)} and final quote price is ${formatCurrency(finalP)}.`,
  ];

  const d = clampMargin(defaultMargin);
  if (Math.abs(m - d) < 0.01) return lines;

  const finalDefault = buildFinalQuotePrice(baseCost, d);
  const quoteDelta = finalP - finalDefault;
  const pts = Math.abs(m - d);

  if (m < d) {
    lines.push(
      `Compared with the quote default (${d}% margin), lowering margin by ${pts.toFixed(0)} percentage points reduces the quote by ${formatCurrency(Math.abs(quoteDelta))}.`
    );
  } else {
    lines.push(
      `Compared with the quote default (${d}% margin), raising margin by ${pts.toFixed(0)} percentage points increases the quote by ${formatCurrency(quoteDelta)}.`
    );
  }
  return lines;
}
