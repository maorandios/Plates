import { formatAreaM2 } from "../job-overview/jobOverview.utils";
import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  PricingSummary,
} from "../types/quickQuote";
import {
  INSIGHTS_CHART_MARGIN_STEP,
  INSIGHTS_DEFAULT_MARGIN_FALLBACK,
  INSIGHTS_MARGIN_MAX,
  INSIGHTS_MARGIN_MIN,
} from "./quoteInsights.mock";
import type {
  MarginCurvePoint,
  QuoteCostInputs,
  QuoteInsightsDerived,
  SheetSensitivityPoint,
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

/** Slider / chart domain for sheet sensitivity (utilization %). */
export const SHEET_SENSITIVITY_UTIL_MIN = 50;
export const SHEET_SENSITIVITY_UTIL_MAX = 90;

export function clampSheetSensitivityUtil(u: number): number {
  const n = Math.round(safeNumber(u, 67));
  return Math.min(
    SHEET_SENSITIVITY_UTIL_MAX,
    Math.max(SHEET_SENSITIVITY_UTIL_MIN, n)
  );
}

/**
 * Effective area of one reference sheet (m²) from quote manufacturing totals.
 * Falls back to 2500×1250 mm when sheet count / area are missing.
 */
export function referenceSheetAreaM2(mfg: ManufacturingParameters): number {
  const count = Math.max(1, Math.round(safeNumber(mfg.estimatedSheetCount, 1)));
  const total = Math.max(0, safeNumber(mfg.totalSheetAreaM2));
  if (total > 0 && count > 0) return total / count;
  return (2500 * 1250) / 1_000_000;
}

export function materialAndSheetsForUtilization(
  totalNetPlateAreaM2: number,
  stockSheetAreaM2: number,
  utilizationPct: number
): { requiredMaterialAreaM2: number; sheetCount: number } {
  const uPct = Math.max(SHEET_SENSITIVITY_UTIL_MIN, Math.min(SHEET_SENSITIVITY_UTIL_MAX, utilizationPct));
  const u = Math.max(1, uPct) / 100;
  const net = Math.max(0, safeNumber(totalNetPlateAreaM2));
  const sheetA = Math.max(1e-9, safeNumber(stockSheetAreaM2, 1e-9));
  const required = net / u;
  const sheetCount = Math.max(1, Math.ceil(required / sheetA));
  return { requiredMaterialAreaM2: required, sheetCount };
}

const SHEET_SENSITIVITY_CHART_STEP = 2;

export function buildSheetSensitivitySeries(
  totalNetPlateAreaM2: number,
  stockSheetAreaM2: number
): SheetSensitivityPoint[] {
  const out: SheetSensitivityPoint[] = [];
  for (
    let u = SHEET_SENSITIVITY_UTIL_MIN;
    u <= SHEET_SENSITIVITY_UTIL_MAX;
    u += SHEET_SENSITIVITY_CHART_STEP
  ) {
    const { requiredMaterialAreaM2, sheetCount } = materialAndSheetsForUtilization(
      totalNetPlateAreaM2,
      stockSheetAreaM2,
      u
    );
    out.push({ utilizationPct: u, sheetCount, requiredMaterialAreaM2 });
  }
  const last = out[out.length - 1];
  if (last && last.utilizationPct < SHEET_SENSITIVITY_UTIL_MAX) {
    const { requiredMaterialAreaM2, sheetCount } = materialAndSheetsForUtilization(
      totalNetPlateAreaM2,
      stockSheetAreaM2,
      SHEET_SENSITIVITY_UTIL_MAX
    );
    out.push({ utilizationPct: SHEET_SENSITIVITY_UTIL_MAX, sheetCount, requiredMaterialAreaM2 });
  }
  return out;
}

/**
 * One-line insight comparing slider utilization to the quote baseline (same net plate area).
 */
export function buildSheetSensitivityInsightSentence(
  quoteUtilizationPct: number,
  sliderUtilizationPct: number,
  totalNetPlateAreaM2: number,
  stockSheetAreaM2: number
): string {
  const base = clampSheetSensitivityUtil(quoteUtilizationPct);
  const cur = clampSheetSensitivityUtil(sliderUtilizationPct);
  const atBase = materialAndSheetsForUtilization(
    totalNetPlateAreaM2,
    stockSheetAreaM2,
    base
  );
  const atCur = materialAndSheetsForUtilization(
    totalNetPlateAreaM2,
    stockSheetAreaM2,
    cur
  );

  if (cur > base && atCur.sheetCount < atBase.sheetCount) {
    return `Improving utilization from ${base}% to ${cur}% reduces sheet count from ${atBase.sheetCount} to ${atCur.sheetCount}.`;
  }
  if (cur < base && atCur.sheetCount > atBase.sheetCount) {
    return `Lowering utilization from ${base}% to ${cur}% increases sheet count from ${atBase.sheetCount} to ${atCur.sheetCount}.`;
  }
  if (cur === base) {
    return `This matches the quote utilization (${base}%): ${atCur.sheetCount} sheet${atCur.sheetCount === 1 ? "" : "s"} at ${formatAreaM2(atCur.requiredMaterialAreaM2)} required material area.`;
  }
  return `At ${cur}% utilization, estimated sheets are ${atCur.sheetCount} with ${formatAreaM2(atCur.requiredMaterialAreaM2)} required material area (quote baseline ${base}%).`;
}
