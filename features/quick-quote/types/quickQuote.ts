import type { ExcelRow } from "@/types";
import type { BendTemplateId } from "../bend-plate/types";
import type { PlateFinish } from "../lib/plateFields";

/**
 * Optional Excel BOM attached to the DXF quote method — persisted in parent so returning after
 * Complete restores the file + mapping alongside approved DXF geometries.
 */
export type DxfMethodExcelSnapshot = {
  fileName: string;
  buffer: ArrayBuffer;
  rows: ExcelRow[];
};

export type QuickQuoteStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** How the user builds this quote after General — set in phase 2, details in phase 3. */
export type QuoteCreationMethod =
  | "dxf"
  | "manualAdd"
  | "bendPlate"
  | "excelImport";

/** One row in the Manually add quote table (phase 3). */
export interface ManualQuotePartRow {
  id: string;
  partNumber: string;
  /** Plate thickness (mm) — used with width/length for weight. */
  thicknessMm: number;
  widthMm: number;
  lengthMm: number;
  quantity: number;
  /** Steel grade / designation (e.g. S235). */
  material: string;
  finish: PlateFinish;
  /**
   * Which quote method created this row — used when merging several methods into one BOM.
   */
  sourceMethod?: QuoteCreationMethod;
  /**
   * Original client-facing label before merge-time deduplication rewrites `partNumber`.
   */
  clientPartLabel?: string;
}

/** One purchased sheet size line for a thickness (catalog or manual). */
export interface QuoteSheetStockLine {
  id: string;
  sheetLengthMm: number;
  sheetWidthMm: number;
  /** Set when this line was added from Preferences purchased-sheet catalog. */
  catalogId?: string;
  /** Set when this line came from Settings → material stock sheet row for this family. */
  materialSheetId?: string;
}

/** Purchased stock for one plate thickness: zero or more sheet sizes (Quick Quote). Material price is global. */
export interface ThicknessStockInput {
  thicknessMm: number;
  sheets: QuoteSheetStockLine[];
}

export type ValidationRowStatus = "valid" | "warning" | "error";

export interface UploadedFileMeta {
  id: string;
  name: string;
  sizeLabel: string;
}

export interface QuickQuoteJobDetails {
  /** Auto-generated unique quote id (e.g. QQ-20260327-AB12CD34). */
  referenceNumber: string;
  /** Project or job title — required on General (used as PDF project name). */
  projectName: string;
  /** Chosen in the Quote method step; drives method-specific details UI. */
  quoteCreationMethod?: QuoteCreationMethod;
  customerName: string;
  /** Present when `customerName` was applied from the global client directory. */
  customerClientId?: string;
  currency: string;
  notes: string;
}

export interface ValidationRow {
  id: string;
  partName: string;
  qty: number;
  /** Nominal thickness from Excel BOM (mm). */
  thicknessMm: number;
  excelLengthMm: number;
  dxfLengthMm: number;
  excelWidthMm: number;
  dxfWidthMm: number;
  excelAreaM2: number;
  dxfAreaM2: number;
  excelWeightKg: number;
  dxfWeightKg: number;
  /** DXF outer cut perimeter (mm). */
  dxfPerimeterMm: number;
  /** Inner contours / pierce count from DXF. */
  dxfPiercingCount: number;
  excelMaterial: string;
  dxfMaterial: string;
  status: ValidationRowStatus;
  dxfFileName: string;
  mismatchFields: string[];
  suggestedReason: string;
  actionRecommendation: string;
}

export interface ValidationSummary {
  totalRows: number;
  matched: number;
  warnings: number;
  critical: number;
}

export type CalcSubStepState = "pending" | "active" | "complete";

export interface CalcSubStep {
  id: string;
  label: string;
  state: CalcSubStepState;
}

export interface JobSummaryMetrics {
  uniqueParts: number;
  totalQty: number;
  totalPlateAreaM2: number;
  totalEstWeightKg: number;
  totalCutLengthMm: number;
  totalPierceCount: number;
}

export interface QuotePartRow {
  id: string;
  /**
   * Source line ids contributing to this row (same method, merged duplicate part numbers).
   * Used to remove the right underlying rows when deleting from the unified table.
   */
  lineSourceIds?: string[];
  /** Unified BOM: DXF | EXCEL | SHAPE | MANUAL; merged rows may combine e.g. "DXF · EXCEL". */
  sourceRef?: string;
  partName: string;
  qty: number;
  material: string;
  thicknessMm: number;
  lengthMm: number;
  widthMm: number;
  areaM2: number;
  weightKg: number;
  cutLengthMm: number;
  pierceCount: number;
  validationStatus: ValidationRowStatus;
  estimatedLineCost: number;
  /** Set for bend-plate lines — used for finalize / PDF plate-type icons. */
  bendTemplateId?: BendTemplateId;
  dxfFileName: string;
  excelRowRef: string;
  notes: string;
}

export interface ManufacturingParameters {
  materialType: string;
  thicknessGroup: string;
  standardStockSize: string;
  totalSheetAreaM2: number;
  utilizationPct: number;
  estimatedSheetCount: number;
  totalNetPlateAreaM2: number;
  /** Gross sheet area minus net plate area (m²); result of rect-pack estimate. */
  wasteAreaM2: number;
  scrapAllowancePct: number;
  totalCutLengthMm: number;
  totalPierceCount: number;
  estimatedMachineTimeMin: number;
  setupCost: number;
  materialRatePerKg: number;
  cutRatePerMm: number;
  pierceRateEach: number;
  overheadPct: number;
  profitMarginPct: number;
}

export interface PricingSummary {
  materialCost: number;
  cuttingCost: number;
  piercingCost: number;
  setupCost: number;
  overhead: number;
  margin: number;
  finalEstimatedPrice: number;
  pricePerKg: number;
  avgPricePerPart: number;
  internalEstCost: number;
}

export interface ValidationRecap {
  fullyMatched: number;
  warningItems: number;
  errorItems: number;
  confidenceNote: string;
}
