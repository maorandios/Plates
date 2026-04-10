import { getMaterialConfig } from "@/lib/settings/materialConfig";
import type { MaterialConfig, MaterialType } from "@/types/materials";
import {
  defaultMaterialGradeForFamily,
  LEGACY_PLATE_FINISH_TO_SETTINGS_FINISH,
  parsePlateFinishFromLabelOrValue,
  type PlateFinish,
} from "./plateFields";

/** Options for Select: enabled list plus current value if missing (import / DXF text). */
export function selectOptionsWithCurrent(
  enabled: readonly string[],
  current: string
): string[] {
  const set = new Set(enabled);
  const out = [...enabled];
  const c = (current ?? "").trim();
  if (c && !set.has(c)) out.push(c);
  return out;
}

function defaultFinishFromConfig(cfg: MaterialConfig): string {
  if (cfg.enabledFinishes.includes("ללא")) return "ללא";
  return cfg.enabledFinishes[0] ?? "ללא";
}

/** Empty / default finish for Phase 2 (matches Settings palette). */
export function phase2DefaultFinish(
  materialType: MaterialType,
  config?: MaterialConfig
): string {
  const cfg = config ?? getMaterialConfig(materialType);
  return defaultFinishFromConfig(cfg);
}

/** Map imported or legacy finish text onto an enabled finish (or keep custom). */
export function normalizeFinishFromImport(
  materialType: MaterialType,
  raw: string | undefined,
  config?: MaterialConfig
): string {
  const cfg = config ?? getMaterialConfig(materialType);
  const enabled = cfg.enabledFinishes;
  const fallback = defaultFinishFromConfig(cfg);

  if (!raw?.trim()) return fallback;

  const t = raw.trim();
  if (enabled.includes(t)) return t;

  if (t === "carbon" || t === "galvanized" || t === "paint") {
    const mapped = LEGACY_PLATE_FINISH_TO_SETTINGS_FINISH[t as PlateFinish];
    if (enabled.includes(mapped)) return mapped;
    if (t === "galvanized") {
      const hit = enabled.find((x) => x.includes("גלוון"));
      if (hit) return hit;
    }
    if (t === "paint") {
      const hit = enabled.find((x) => x.includes("צבוע"));
      if (hit) return hit;
    }
    return fallback;
  }

  const parsed = parsePlateFinishFromLabelOrValue(t);
  if (parsed) {
    const mapped = LEGACY_PLATE_FINISH_TO_SETTINGS_FINISH[parsed];
    if (enabled.includes(mapped)) return mapped;
    if (parsed === "galvanized") {
      const hit = enabled.find((x) => x.includes("גלוון"));
      if (hit) return hit;
    }
    if (parsed === "paint") {
      const hit = enabled.find((x) => x.includes("צבוע"));
      if (hit) return hit;
    }
    return fallback;
  }

  const low = t.toLowerCase();
  if (t.includes("מגולוון") || low.includes("galvan")) {
    const hit = enabled.find((x) => x.includes("גלוון") || x.includes("מגולוון"));
    if (hit) return hit;
  }
  if (t.includes("צבוע") || low.includes("paint")) {
    const hit = enabled.find((x) => x.includes("צבוע"));
    if (hit) return hit;
  }
  if (t.includes("ללא") || low === "none") {
    if (enabled.includes("ללא")) return "ללא";
  }
  if (t.includes("פח שחור") || t.includes("שחור") || low.includes("black steel")) {
    if (enabled.includes("ללא")) return "ללא";
  }

  return t;
}

/** DXF geometry / localStorage: coerce legacy enum or Hebrew to current settings labels. */
export function normalizeStoredReviewFinish(
  raw: unknown,
  materialType: MaterialType,
  config?: MaterialConfig
): string {
  if (raw == null || raw === "") return phase2DefaultFinish(materialType, config);
  return normalizeFinishFromImport(materialType, String(raw), config);
}
