import type { ProfileRotationMode } from "./production";

/** Stock assignment for nesting / cutting workflows (per batch, per thickness). */

export type StockSheetType = "purchase" | "leftover";

/**
 * Batch-only cutting/nesting defaults for a specific plate thickness group.
 * Does not change company Settings profiles.
 */
export interface BatchThicknessOverride {
  id: string;
  batchId: string;
  /** Same semantics as part/stock grouping: null = “thickness not set” band */
  thicknessMm: number | null;
  spacingMm: number;
  edgeMarginMm: number;
  allowRotation: boolean;
  rotationMode: ProfileRotationMode;
  defaultMarkPartName: boolean;
  defaultIncludeClientCode: boolean;
  updatedAt: string;
}

export interface StockSheetEntry {
  id: string;
  batchId: string;
  /**
   * Plate thickness in mm for this stock line. `null` pairs with the
   * "thickness not set" parts group when BOM had no thickness.
   */
  thicknessMm: number | null;
  /** Sheet width in mm */
  widthMm: number;
  /** Sheet length in mm */
  lengthMm: number;
  type: StockSheetType;
  /** Reserved for future (e.g. disable without deleting) */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
