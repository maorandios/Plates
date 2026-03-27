import type { JobSummaryMetrics, ManufacturingParameters, PricingSummary } from "../types/quickQuote";

/** Cost components that form the pre-margin base (no profit). */
export interface QuoteCostInputs {
  materialCost: number;
  cuttingCost: number;
  piercingCost: number;
  setupCost: number;
  overheadCost: number;
}

export interface MarginCurvePoint {
  marginPercent: number;
  finalQuotePrice: number;
  profitAmount: number;
}

export interface QuoteInsightsDerived {
  baseCost: number;
  profitAmount: number;
  finalQuotePrice: number;
  pricePerKg: number;
  /** True when weight was missing or invalid; pricePerKg is 0. */
  pricePerKgUnavailable: boolean;
}

export interface QuoteInsightsProps {
  pricing: PricingSummary;
  mfgParams: ManufacturingParameters;
  jobSummary: JobSummaryMetrics;
  currencyCode: string;
}

/** One point on the sheet-count vs utilization sensitivity curve. */
export interface SheetSensitivityPoint {
  utilizationPct: number;
  sheetCount: number;
  requiredMaterialAreaM2: number;
}
