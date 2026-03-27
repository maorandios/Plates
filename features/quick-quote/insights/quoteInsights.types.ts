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

export interface CostBreakdownRow {
  key: string;
  label: string;
  value: number;
  /** Neutral fill for Recharts (hex). */
  fill: string;
}

export interface QuoteInsightsDerived {
  baseCost: number;
  profitAmount: number;
  finalQuotePrice: number;
  pricePerKg: number;
  /** True when weight was missing or invalid; pricePerKg is 0. */
  pricePerKgUnavailable: boolean;
}

export interface ShareBreakdown {
  materialShare: number;
  processingShare: number;
  marginShare: number;
}

export interface LargestCostInfo {
  key: string;
  label: string;
  value: number;
}

export interface QuoteInsightsProps {
  pricing: PricingSummary;
  mfgParams: ManufacturingParameters;
  jobSummary: JobSummaryMetrics;
  currencyCode: string;
}
