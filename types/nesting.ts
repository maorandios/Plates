/** Stock assignment for nesting / cutting workflows (per batch, per thickness). */

export type StockSheetType = "purchase" | "leftover";

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
