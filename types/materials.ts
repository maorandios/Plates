/**
 * Material configuration for quotation MVP.
 * Defines pricing and stock sheets (with per-size thickness availability) for the 3 main material families.
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

export type MaterialPricingMode = "perKg" | "perM2";

/** Default thickness list when migrating legacy configs or seeding new sheets. */
export const DEFAULT_STOCK_THICKNESSES_MM = [3, 6, 10, 20] as const;

export interface MaterialStockSheet {
  id: string;
  widthMm: number;
  lengthMm: number;
  /** Thicknesses (mm) available in this stock size — user-defined per sheet row. */
  thicknessesMm: number[];
  enabled: boolean;
  updatedAt: string;
}

export interface MaterialConfig {
  materialType: MaterialType;
  displayName: string;
  /** Material density in kg/m³ (used when pricing mode is perKg). */
  densityKgPerM3: number;
  /** Default markup % applied to material cost. */
  defaultMarkupPercent: number;
  /** Pricing mode: per kg or per m². */
  pricingMode: MaterialPricingMode;
  /** Material price (per kg or per m² depending on pricingMode). */
  materialPrice: number;
  /** Default scrap/waste % for sheet estimation. */
  defaultScrapPercent: number;
  /** Available stock sheet sizes for this material. */
  stockSheets: MaterialStockSheet[];
  updatedAt: string;
}

function stockSheetsWithDefaults(now: string, idPrefix: string): MaterialStockSheet[] {
  const t = [...DEFAULT_STOCK_THICKNESSES_MM];
  return [
    {
      id: `${idPrefix}-1`,
      widthMm: 1250,
      lengthMm: 2500,
      thicknessesMm: t,
      enabled: true,
      updatedAt: now,
    },
    {
      id: `${idPrefix}-2`,
      widthMm: 1500,
      lengthMm: 3000,
      thicknessesMm: t,
      enabled: true,
      updatedAt: now,
    },
  ];
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
