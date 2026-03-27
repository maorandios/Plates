import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  QuotePartRow,
  ThicknessStockInput,
} from "../types/quickQuote";

export type ComplexityLevel = "Low" | "Medium" | "High";

export type UtilizationBand = "Low efficiency" | "Moderate efficiency" | "Good efficiency";

export interface MaterialBreakdownRow {
  /** e.g. "S355 / 12 mm" */
  label: string;
  /** 0–1 share of job mass (or area fallback). */
  share: number;
  /** Total mass for this line (kg); 0 if estimated from area only. */
  massKg: number;
  thicknessMm: number;
  /** Net plate area for this grade × thickness (m²). */
  netAreaM2: number;
  /**
   * Estimated sheets from quote stock + nesting yield (same rule as quote totals).
   * Null when stock was not configured for this thickness.
   */
  stockSheetsCaption: string | null;
}

export interface PartFootprint {
  lengthMm: number;
  widthMm: number;
  areaMm2: number;
}

export interface SizeRangeInfo {
  largest: PartFootprint;
  smallest: PartFootprint;
}

/** Fully derived view model for the Job Overview UI. */
export interface JobOverviewModel {
  totalParts: number;
  totalPlates: number;
  totalWeightKg: number;
  netPlateAreaM2: number;
  grossMaterialAreaM2: number;
  estimatedSheetCount: number;
  utilizationPct: number;
  utilizationBand: UtilizationBand;
  totalCutLengthMm: number;
  totalPierceCount: number;
  complexity: ComplexityLevel;
  complexitySubtext: string;
  materialBreakdown: MaterialBreakdownRow[];
  sizeRange: SizeRangeInfo | null;
  quickInsights: string[];
}

export interface BuildJobOverviewInput {
  jobSummary: JobSummaryMetrics;
  mfgParams: ManufacturingParameters;
  parts: QuotePartRow[];
  /** Purchased stock per thickness from the quote flow (for sheet estimates). */
  thicknessStock?: ThicknessStockInput[] | null;
}
