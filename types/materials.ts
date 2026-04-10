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
  carbonSteel: "פלדה",
  stainlessSteel: "נירוסטה",
  aluminum: "אלומיניום",
};

/** Default סיווג options per material (settings palette). */
export const MATERIAL_GRADE_OPTIONS: Record<MaterialType, readonly string[]> = {
  carbonSteel: ["S235", "S235JR", "S355", "ST-37", "ST-52", "S275"],
  aluminum: ["1015", "3003", "5052", "5083", "6061", "6063"],
  stainlessSteel: ["304", "316", "430"],
};

/** Default גימור options per material (settings palette). */
export const MATERIAL_FINISH_OPTIONS: Record<MaterialType, readonly string[]> = {
  carbonSteel: ["ללא", "גלוון חם", "גלוון קר", "צבוע"],
  aluminum: ["ללא", "אנודייז", "צביעה", "מבריק", "מוברש + אנודייז"],
  stainlessSteel: ["ללא", "מבריק", "מוברש", "BA"],
};

/**
 * Persisted config with older tag-list schema may omit recommended palette entries; those blobs are migrated once on load.
 */
export const MATERIAL_TAG_LIST_SCHEMA_VERSION = 2;

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
  /** User-defined סיווג list (defaults start from MATERIAL_GRADE_OPTIONS). */
  enabledGrades: string[];
  /** User-defined גימור list (defaults start from MATERIAL_FINISH_OPTIONS). */
  enabledFinishes: string[];
  /** Version for סיווג/גימור list persistence (drives one-time merge of recommended palettes). */
  tagListSchemaVersion: number;
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
    enabledGrades: [...MATERIAL_GRADE_OPTIONS.carbonSteel],
    enabledFinishes: [...MATERIAL_FINISH_OPTIONS.carbonSteel],
    tagListSchemaVersion: MATERIAL_TAG_LIST_SCHEMA_VERSION,
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
    enabledGrades: [...MATERIAL_GRADE_OPTIONS.stainlessSteel],
    enabledFinishes: [...MATERIAL_FINISH_OPTIONS.stainlessSteel],
    tagListSchemaVersion: MATERIAL_TAG_LIST_SCHEMA_VERSION,
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
    enabledGrades: [...MATERIAL_GRADE_OPTIONS.aluminum],
    enabledFinishes: [...MATERIAL_FINISH_OPTIONS.aluminum],
    tagListSchemaVersion: MATERIAL_TAG_LIST_SCHEMA_VERSION,
    stockSheets: stockSheetsWithDefaults(now, "al-sheet"),
    updatedAt: now,
  };
}
