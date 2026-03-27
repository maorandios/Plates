export type QuickQuoteStep = 1 | 2 | 3 | 4 | 5;

/** One purchased sheet size line for a thickness (catalog or manual). */
export interface QuoteSheetStockLine {
  id: string;
  sheetLengthMm: number;
  sheetWidthMm: number;
  /** Set when this line was added from Preferences purchased-sheet catalog. */
  catalogId?: string;
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
  excelLengthMm: number;
  dxfLengthMm: number;
  excelWidthMm: number;
  dxfWidthMm: number;
  excelAreaM2: number;
  dxfAreaM2: number;
  excelWeightKg: number;
  dxfWeightKg: number;
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
