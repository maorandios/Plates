import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  QuotePartRow,
  ThicknessStockInput,
} from "../types/quickQuote";

export type ComplexityLevel = "Low" | "Medium" | "High";

/** Keys into `quote.quantityAnalysis.complexityDetail.*` */
export type ComplexityDetailId =
  | "moderate"
  | "simple"
  | "highDense"
  | "highHeavy"
  | "mediumPierce";

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

/**
 * One nesting line: material + thickness + chosen stock sheet size (rect-pack per group).
 * Not merged across materials or thicknesses.
 */
export interface StockSheetSizeBreakdownRow {
  /** e.g. "S235 · 10 mm · 1500 × 3000 mm" */
  label: string;
  /** Material grade / designation */
  material: string;
  thicknessMm: number;
  sheetWidthMm: number;
  sheetLengthMm: number;
  /** Area of one sheet (m²). */
  sheetAreaM2: number;
  sheetCount: number;
  /** Total purchased sheet area (sheetCount × sheetAreaM2). */
  grossStockAreaM2: number;
  netPlateAreaM2: number;
  wasteAreaM2: number;
  /** 0–100 — net ÷ gross */
  utilizationPct: number;
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
  /** Gross sheet area minus net plate area — actual material waste from rect-pack. */
  wasteAreaM2: number;
  totalCutLengthMm: number;
  totalPierceCount: number;
  complexity: ComplexityLevel;
  complexityDetailId: ComplexityDetailId;
  materialBreakdown: MaterialBreakdownRow[];
}

export interface BuildJobOverviewInput {
  jobSummary: JobSummaryMetrics;
  mfgParams: ManufacturingParameters;
  parts: QuotePartRow[];
  /** Purchased stock per thickness from the quote flow (for sheet estimates). */
  thicknessStock?: ThicknessStockInput[] | null;
}
