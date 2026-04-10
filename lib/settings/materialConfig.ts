/**
 * Material configuration persistence and query helpers for quotation MVP.
 */

import type { MaterialConfig, MaterialType, MaterialStockSheet } from "@/types/materials";
import {
  defaultCarbonSteelConfig,
  defaultStainlessSteelConfig,
  defaultAluminumConfig,
  MATERIAL_FINISH_OPTIONS,
  MATERIAL_GRADE_OPTIONS,
  MATERIAL_TAG_LIST_SCHEMA_VERSION,
} from "@/types/materials";

function normalizeStringTagList(arr: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * v0/v1: re-merge full recommended palette (in order) plus any custom tags not in the palette.
 * v2+: use stored list as-is (empty array allowed).
 */
function normalizeTagListField(
  storedSchemaVersion: number,
  o: Record<string, unknown>,
  key: "enabledGrades" | "enabledFinishes",
  palette: readonly string[]
): string[] {
  const fallback = [...palette];
  if (!(key in o)) return fallback;
  const raw = o[key];
  if (!Array.isArray(raw)) return fallback;
  const saved = normalizeStringTagList(raw);

  if (storedSchemaVersion >= MATERIAL_TAG_LIST_SCHEMA_VERSION) {
    return saved;
  }

  const paletteSet = new Set(palette);
  const customs = saved.filter((s) => !paletteSet.has(s));
  return [...palette, ...customs];
}

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

/** Normalize configs from localStorage (legacy fields may be present). */
function normalizeMaterialConfig(raw: unknown, materialType: MaterialType): MaterialConfig {
  const base = defaultForType(materialType);
  if (!raw || typeof raw !== "object") return base;

  const o = raw as Record<string, unknown>;
  const storedSchemaVersion =
    typeof o.tagListSchemaVersion === "number" ? o.tagListSchemaVersion : 0;

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

      return {
        id,
        widthMm,
        lengthMm,
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
    pricingMode: "perKg",
    materialPrice: typeof o.materialPrice === "number" ? o.materialPrice : base.materialPrice,
    defaultScrapPercent:
      typeof o.defaultScrapPercent === "number" ? o.defaultScrapPercent : base.defaultScrapPercent,
    enabledGrades: normalizeTagListField(
      storedSchemaVersion,
      o,
      "enabledGrades",
      MATERIAL_GRADE_OPTIONS[materialType]
    ),
    enabledFinishes: normalizeTagListField(
      storedSchemaVersion,
      o,
      "enabledFinishes",
      MATERIAL_FINISH_OPTIONS[materialType]
    ),
    tagListSchemaVersion: MATERIAL_TAG_LIST_SCHEMA_VERSION,
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
    const key = materialStorageKey(materialType);
    const raw = localStorage.getItem(key);
    if (!raw) return defaultForType(materialType);
    const parsed = JSON.parse(raw) as unknown;
    const rawObj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    const prevSchema =
      rawObj && typeof rawObj.tagListSchemaVersion === "number" ? rawObj.tagListSchemaVersion : 0;
    const normalized = normalizeMaterialConfig(parsed, materialType);
    if (prevSchema < MATERIAL_TAG_LIST_SCHEMA_VERSION) {
      saveMaterialConfig(normalized);
    }
    return normalized;
  } catch {
    return defaultForType(materialType);
  }
}

/** Save material config to localStorage. */
export function saveMaterialConfig(config: MaterialConfig): void {
  if (typeof window === "undefined") return;
  try {
    const updated: MaterialConfig = {
      ...config,
      pricingMode: "perKg",
      tagListSchemaVersion: MATERIAL_TAG_LIST_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    };
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
