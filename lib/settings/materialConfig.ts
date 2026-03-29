/**
 * Material configuration persistence and query helpers for quotation MVP.
 */

import type { MaterialConfig, MaterialType, MaterialStockSheet } from "@/types/materials";
import {
  defaultCarbonSteelConfig,
  defaultStainlessSteelConfig,
  defaultAluminumConfig,
  DEFAULT_STOCK_THICKNESSES_MM,
} from "@/types/materials";

const STORAGE_KEY_PREFIX = "plate_material_config_";

function materialStorageKey(materialType: MaterialType): string {
  return `${STORAGE_KEY_PREFIX}${materialType}`;
}

function defaultForType(materialType: MaterialType): MaterialConfig {
  if (materialType === "carbonSteel") return defaultCarbonSteelConfig();
  if (materialType === "stainlessSteel") return defaultStainlessSteelConfig();
  if (materialType === "aluminum") return defaultAluminumConfig();
  return defaultCarbonSteelConfig();
}

type LegacyThicknessRule = {
  thicknessMm?: number;
  enabled?: boolean;
};

/** Normalize configs saved before thicknessesMm / after removing thickness rules. */
function normalizeMaterialConfig(raw: unknown, materialType: MaterialType): MaterialConfig {
  const base = defaultForType(materialType);
  if (!raw || typeof raw !== "object") return base;

  const o = raw as Record<string, unknown>;
  const legacyRules = o.thicknessRules as LegacyThicknessRule[] | undefined;
  const fromRules =
    Array.isArray(legacyRules) && legacyRules.length > 0
      ? [
          ...new Set(
            legacyRules
              .filter((r) => r && r.enabled !== false && typeof r.thicknessMm === "number")
              .map((r) => r.thicknessMm as number)
          ),
        ].sort((a, b) => a - b)
      : [...DEFAULT_STOCK_THICKNESSES_MM];

  const fallbackThicknesses = fromRules.length > 0 ? fromRules : [...DEFAULT_STOCK_THICKNESSES_MM];

  const sheetsIn = o.stockSheets;
  let stockSheets: MaterialStockSheet[];

  if (!Array.isArray(sheetsIn) || sheetsIn.length === 0) {
    stockSheets = base.stockSheets;
  } else {
    stockSheets = sheetsIn.map((s: Record<string, unknown>, idx: number) => {
      const id = typeof s.id === "string" ? s.id : `sheet-${idx}`;
      const widthMm = typeof s.widthMm === "number" ? s.widthMm : 1250;
      const lengthMm = typeof s.lengthMm === "number" ? s.lengthMm : 2500;
      const enabled = s.enabled !== false;
      const updatedAt = typeof s.updatedAt === "string" ? s.updatedAt : new Date().toISOString();

      let thicknessesMm: number[] = [];
      const tm = s.thicknessesMm;
      if (Array.isArray(tm)) {
        thicknessesMm = tm
          .filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0)
          .map((x) => x);
      }
      if (thicknessesMm.length === 0) {
        thicknessesMm = [...fallbackThicknesses];
      } else {
        thicknessesMm = [...new Set(thicknessesMm)].sort((a, b) => a - b);
      }

      return {
        id,
        widthMm,
        lengthMm,
        thicknessesMm,
        enabled,
        updatedAt,
      };
    });
  }

  return {
    materialType,
    displayName: typeof o.displayName === "string" ? o.displayName : base.displayName,
    densityKgPerM3: typeof o.densityKgPerM3 === "number" ? o.densityKgPerM3 : base.densityKgPerM3,
    defaultMarkupPercent:
      typeof o.defaultMarkupPercent === "number" ? o.defaultMarkupPercent : base.defaultMarkupPercent,
    pricingMode: o.pricingMode === "perM2" || o.pricingMode === "perKg" ? o.pricingMode : base.pricingMode,
    materialPrice: typeof o.materialPrice === "number" ? o.materialPrice : base.materialPrice,
    defaultScrapPercent:
      typeof o.defaultScrapPercent === "number" ? o.defaultScrapPercent : base.defaultScrapPercent,
    stockSheets,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

/** Load material config from localStorage or return defaults. */
export function getMaterialConfig(materialType: MaterialType): MaterialConfig {
  if (typeof window === "undefined") {
    return defaultForType(materialType);
  }

  try {
    const raw = localStorage.getItem(materialStorageKey(materialType));
    if (!raw) return defaultForType(materialType);
    const parsed = JSON.parse(raw) as unknown;
    return normalizeMaterialConfig(parsed, materialType);
  } catch {
    return defaultForType(materialType);
  }
}

/** Save material config to localStorage. */
export function saveMaterialConfig(config: MaterialConfig): void {
  if (typeof window === "undefined") return;
  try {
    const updated = { ...config, updatedAt: new Date().toISOString() };
    localStorage.setItem(materialStorageKey(config.materialType), JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("plate-material-config-changed", { detail: { materialType: config.materialType } })
    );
  } catch (e) {
    console.warn("[PLATE] Failed to save material config", e);
  }
}

/** Get all material configs. */
export function getAllMaterialConfigs(): MaterialConfig[] {
  return [
    getMaterialConfig("carbonSteel"),
    getMaterialConfig("stainlessSteel"),
    getMaterialConfig("aluminum"),
  ];
}

/**
 * Preferred stock sheet for quote estimation: largest enabled sheet by area (width × length).
 * If none enabled, returns null.
 */
export function getDefaultSheetForMaterial(materialType: MaterialType): MaterialStockSheet | null {
  const config = getMaterialConfig(materialType);
  const enabled = config.stockSheets.filter((s) => s.enabled);
  if (enabled.length === 0) return null;

  const sorted = [...enabled].sort(
    (a, b) => b.widthMm * b.lengthMm - a.widthMm * a.lengthMm
  );
  return sorted[0];
}

/** Thicknesses available on a stock sheet (mm), deduped and sorted. */
export function getThicknessesForStockSheet(sheet: MaterialStockSheet): number[] {
  return [...new Set(sheet.thicknessesMm.filter((t) => t > 0))].sort((a, b) => a - b);
}

/** Subscribe to material config changes. */
export function subscribeMaterialConfigChanged(
  materialType: MaterialType,
  callback: () => void
): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.materialType === materialType) callback();
  };
  window.addEventListener("plate-material-config-changed", handler);
  return () => window.removeEventListener("plate-material-config-changed", handler);
}
