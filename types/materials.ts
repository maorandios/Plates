/**
 * Material configuration for quotation MVP.
 * Defines pricing and stock sheet sizes for the 3 main material families.
 */

export type MaterialType = "carbonSteel" | "stainlessSteel" | "aluminum";

export const MATERIAL_TYPE_OPTIONS: readonly MaterialType[] = [
  "carbonSteel",
  "stainlessSteel",
  "aluminum",
] as const;

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  carbonSteel: "Carbon Steel",
  stainlessSteel: "Stainless Steel",
  aluminum: "Aluminum",
};

/** Material price is always per kg. */
export type MaterialPricingMode = "perKg";

export interface MaterialStockSheet {
  id: string;
  widthMm: number;
  lengthMm: number;
  /** Stock applies to all plate thicknesses in the quote stock step. */
  enabled: boolean;
  updatedAt: string;
}

export interface MaterialConfig {
  materialType: MaterialType;
  displayName: string;
  /** Material density in kg/m³ (used to estimate weight from area). */
  densityKgPerM3: number;
  /** Default markup % applied to material cost. */
  defaultMarkupPercent: number;
  pricingMode: MaterialPricingMode;
  /** Material price per kg. */
  materialPrice: number;
  /** Default scrap/waste % for sheet estimation. */
  defaultScrapPercent: number;
  /** Available stock sheet sizes for this material (all sizes apply to every thickness). */
  stockSheets: MaterialStockSheet[];
  updatedAt: string;
}

/** Default sheet sizes (mm) for all steel families — width × length. */
export const DEFAULT_STOCK_SHEET_SIZES_MM: ReadonlyArray<{ widthMm: number; lengthMm: number }> = [
  { widthMm: 1000, lengthMm: 2000 },
  { widthMm: 1250, lengthMm: 2500 },
  { widthMm: 1500, lengthMm: 3000 },
];

function stockSheetsWithDefaults(now: string, idPrefix: string): MaterialStockSheet[] {
  return DEFAULT_STOCK_SHEET_SIZES_MM.map((dims, i) => ({
    id: `${idPrefix}-${i + 1}`,
    widthMm: dims.widthMm,
    lengthMm: dims.lengthMm,
    enabled: true,
    updatedAt: now,
  }));
}

/** Sensible defaults for Carbon Steel. */
export function defaultCarbonSteelConfig(): MaterialConfig {
  const now = new Date().toISOString();
  return {
    materialType: "carbonSteel",
    displayName: "Carbon Steel",
    densityKgPerM3: 7850,
    defaultMarkupPercent: 20,
    pricingMode: "perKg",
    materialPrice: 0.85,
    defaultScrapPercent: 15,
    stockSheets: stockSheetsWithDefaults(now, "cs-sheet"),
    updatedAt: now,
  };
}

/** Sensible defaults for Stainless Steel. */
export function defaultStainlessSteelConfig(): MaterialConfig {
  const now = new Date().toISOString();
  return {
    materialType: "stainlessSteel",
    displayName: "Stainless Steel",
    densityKgPerM3: 8000,
    defaultMarkupPercent: 25,
    pricingMode: "perKg",
    materialPrice: 3.2,
    defaultScrapPercent: 15,
    stockSheets: stockSheetsWithDefaults(now, "ss-sheet"),
    updatedAt: now,
  };
}

/** Sensible defaults for Aluminum. */
export function defaultAluminumConfig(): MaterialConfig {
  const now = new Date().toISOString();
  return {
    materialType: "aluminum",
    displayName: "Aluminum",
    densityKgPerM3: 2700,
    defaultMarkupPercent: 30,
    pricingMode: "perKg",
    materialPrice: 2.5,
    defaultScrapPercent: 12,
    stockSheets: stockSheetsWithDefaults(now, "al-sheet"),
    updatedAt: now,
  };
}
