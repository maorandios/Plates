import type {
  CuttingMethod,
  CuttingProfileRange,
  ProfileRotationMode,
} from "@/types/production";
import {
  CUTTING_METHOD_OPTIONS,
  DEFAULT_CUTTING_PROFILE_RANGES,
  DEFAULT_THICKNESS_BAND_MAX_MM,
} from "@/types/production";

const STORAGE_KEY_V2 = "plate_cutting_profile_ranges_v2";
const LEGACY_KEY = "plate_cutting_profiles";

const CHANGE = "plate-cutting-profiles-changed";

type StoredV2 = { version: 2; ranges: CuttingProfileRange[] };

/** Legacy: one blob per cutting method */
type LegacyStored = Partial<
  Record<
    CuttingMethod,
    {
      defaultSpacingMm?: number;
      defaultEdgeMarginMm?: number;
      allowRotation?: boolean;
      rotationMode?: string;
      defaultMarkPartName?: boolean;
      defaultIncludeClientCode?: boolean;
      updatedAt?: string;
    }
  >
>;

function dispatchChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE));
  }
}

/** Physical sheet stock: thickness rules use 1 mm minimum (no 0 mm plate). */
export const MIN_PLATE_THICKNESS_MM = 1;

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function clampMinPlateThicknessMm(n: number): number {
  return Math.max(MIN_PLATE_THICKNESS_MM, clampNonNegative(n));
}

export function normalizeProfileRotationMode(v: unknown): ProfileRotationMode {
  if (v === "free") return "free";
  if (v === "ninetyOnly" || v === "ninety_only") return "ninetyOnly";
  return "ninetyOnly";
}

function normalizeRange(raw: Partial<CuttingProfileRange> & { id: string; method: CuttingMethod }): CuttingProfileRange {
  const base = DEFAULT_CUTTING_PROFILE_RANGES.find((r) => r.id === raw.id);
  const fallback =
    base ??
    DEFAULT_CUTTING_PROFILE_RANGES.find((r) => r.method === raw.method) ??
    DEFAULT_CUTTING_PROFILE_RANGES[0];

  let maxThicknessMm: number | null;
  if (raw.maxThicknessMm === undefined) {
    maxThicknessMm = base?.maxThicknessMm ?? null;
  } else if (raw.maxThicknessMm === null) {
    maxThicknessMm = null;
  } else {
    const n = Number(raw.maxThicknessMm);
    maxThicknessMm = Number.isFinite(n) ? n : null;
  }

  return {
    id: raw.id,
    method: raw.method,
    minThicknessMm: clampMinPlateThicknessMm(
      Number(raw.minThicknessMm ?? base?.minThicknessMm ?? MIN_PLATE_THICKNESS_MM)
    ),
    maxThicknessMm,
    defaultSpacingMm: clampNonNegative(
      Number(raw.defaultSpacingMm ?? fallback.defaultSpacingMm)
    ),
    defaultEdgeMarginMm: clampNonNegative(
      Number(raw.defaultEdgeMarginMm ?? fallback.defaultEdgeMarginMm)
    ),
    // Rotation is always enabled; only the mode (90° vs free) is stored.
    allowRotation: true,
    rotationMode: normalizeProfileRotationMode(
      raw.rotationMode ?? fallback.rotationMode
    ),
    // Part number on nested parts is always on; field kept for compatibility.
    defaultMarkPartName: true,
    defaultIncludeClientCode:
      typeof raw.defaultIncludeClientCode === "boolean"
        ? raw.defaultIncludeClientCode
        : (fallback.defaultIncludeClientCode ?? false),
    sortOrder: Number.isFinite(Number(raw.sortOrder))
      ? Number(raw.sortOrder)
      : (base?.sortOrder ?? 0),
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : (base?.updatedAt ?? new Date().toISOString()),
  };
}

function migrateLegacy(legacy: LegacyStored): CuttingProfileRange[] {
  const out: CuttingProfileRange[] = [];
  let t = Date.now();
  for (const method of CUTTING_METHOD_OPTIONS) {
    const p = legacy[method];
    if (!p || p.defaultSpacingMm == null) continue;
    out.push({
      id: `migrated-${method}-${t++}`,
      method,
      minThicknessMm: MIN_PLATE_THICKNESS_MM,
      maxThicknessMm: DEFAULT_THICKNESS_BAND_MAX_MM,
      defaultSpacingMm: clampNonNegative(p.defaultSpacingMm),
      defaultEdgeMarginMm: clampNonNegative(p.defaultEdgeMarginMm ?? 5),
      allowRotation: p.allowRotation !== false,
      rotationMode: normalizeProfileRotationMode(p.rotationMode),
      defaultMarkPartName: p.defaultMarkPartName !== false,
      defaultIncludeClientCode: p.defaultIncludeClientCode === true,
      sortOrder: 0,
      updatedAt: p.updatedAt ?? new Date().toISOString(),
    });
  }
  return out.length > 0 ? out : [...DEFAULT_CUTTING_PROFILE_RANGES];
}

function loadRawFile(): StoredV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const v2 = localStorage.getItem(STORAGE_KEY_V2);
    if (v2) {
      const parsed = JSON.parse(v2) as StoredV2;
      if (parsed?.version === 2 && Array.isArray(parsed.ranges)) {
        return parsed;
      }
    }
    const legRaw = localStorage.getItem(LEGACY_KEY);
    if (legRaw) {
      const leg = JSON.parse(legRaw) as LegacyStored;
      const ranges = migrateLegacy(leg);
      const next: StoredV2 = { version: 2, ranges };
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(next));
      localStorage.removeItem(LEGACY_KEY);
      return next;
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** Ranges persisted in localStorage only (no default merge). */
function loadFileRangesOnly(): CuttingProfileRange[] {
  const file = loadRawFile();
  if (!file?.ranges.length) return [];
  return file.ranges
    .filter(
      (r) =>
        r?.id &&
        typeof r.method === "string" &&
        CUTTING_METHOD_OPTIONS.includes(r.method as CuttingMethod)
    )
    .map((r) => normalizeRange(r as CuttingProfileRange));
}

function saveV2(ranges: CuttingProfileRange[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredV2 = { version: 2, ranges };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(payload));
  } catch (e) {
    console.warn("[PLATE] Failed to save cutting profile ranges", e);
  }
  dispatchChange();
}

/**
 * All ranges: per method, use file rows if any; otherwise built-in seeds.
 */
export function getAllCuttingProfileRanges(): CuttingProfileRange[] {
  const fromFile = loadFileRangesOnly();
  const out: CuttingProfileRange[] = [];
  for (const m of CUTTING_METHOD_OPTIONS) {
    const userRows = fromFile.filter((r) => r.method === m);
    if (userRows.length === 0) {
      out.push(
        ...DEFAULT_CUTTING_PROFILE_RANGES.filter((r) => r.method === m).map(
          (r) => ({ ...r })
        )
      );
    } else {
      out.push(...userRows);
    }
  }
  return out;
}

/** Ranges for one method, ordered for display and matching. */
export function getCuttingProfileRanges(
  method: CuttingMethod
): CuttingProfileRange[] {
  return getAllCuttingProfileRanges()
    .filter((r) => r.method === method)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Pick the rule for a part thickness (mm): inclusive bounds, highest min wins on boundaries.
 */
export function getMatchingCuttingProfileRule(
  method: CuttingMethod,
  thicknessMm: number
): CuttingProfileRange | null {
  if (!Number.isFinite(thicknessMm)) return null;
  const t = thicknessMm;
  const sorted = [...getCuttingProfileRanges(method)].sort(
    (a, b) => b.minThicknessMm - a.minThicknessMm
  );
  for (const r of sorted) {
    if (t < r.minThicknessMm) continue;
    if (r.maxThicknessMm !== null && t > r.maxThicknessMm) continue;
    return r;
  }
  return null;
}

/** Upper bound as number for overlap math (infinity when unbounded). */
function upperBound(maxThicknessMm: number | null): number {
  return maxThicknessMm === null ? Number.POSITIVE_INFINITY : maxThicknessMm;
}

/**
 * True if two closed thickness intervals share more than a single boundary point.
 */
export function rangesStrictOverlap(
  minA: number,
  maxA: number | null,
  minB: number,
  maxB: number | null
): boolean {
  const uA = upperBound(maxA);
  const uB = upperBound(maxB);
  return Math.max(minA, minB) < Math.min(uA, uB);
}

export function thicknessFallsInRange(
  thicknessMm: number,
  r: Pick<CuttingProfileRange, "minThicknessMm" | "maxThicknessMm">
): boolean {
  if (!Number.isFinite(thicknessMm)) return false;
  if (thicknessMm < r.minThicknessMm) return false;
  if (r.maxThicknessMm !== null && thicknessMm > r.maxThicknessMm) return false;
  return true;
}

/** Same min and same max (including both null upper). */
export function rangesAreDuplicate(
  a: Pick<CuttingProfileRange, "minThicknessMm" | "maxThicknessMm">,
  b: Pick<CuttingProfileRange, "minThicknessMm" | "maxThicknessMm">
): boolean {
  return (
    a.minThicknessMm === b.minThicknessMm &&
    (a.maxThicknessMm === b.maxThicknessMm ||
      (a.maxThicknessMm === null && b.maxThicknessMm === null))
  );
}

export interface RangeValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validate one method’s rule list (all entries must share the same `method`). */
export function validateCuttingProfileRangesForMethod(
  methodRanges: CuttingProfileRange[]
): RangeValidationResult {
  const errors: string[] = [];

  for (const r of methodRanges) {
    if (
      !Number.isFinite(r.minThicknessMm) ||
      r.minThicknessMm < MIN_PLATE_THICKNESS_MM
    ) {
      errors.push(
        `Min thickness must be at least ${MIN_PLATE_THICKNESS_MM} mm (sheet stock does not use 0 mm).`
      );
      break;
    }
    if (
      r.maxThicknessMm !== null &&
      (!Number.isFinite(r.maxThicknessMm) ||
        r.maxThicknessMm <= r.minThicknessMm)
    ) {
      errors.push(
        "Max thickness must be empty (no upper limit) or greater than min thickness."
      );
      break;
    }
    if (!Number.isFinite(r.defaultSpacingMm) || r.defaultSpacingMm < 0) {
      errors.push("Spacing must be ≥ 0.");
      break;
    }
    if (!Number.isFinite(r.defaultEdgeMarginMm) || r.defaultEdgeMarginMm < 0) {
      errors.push("Edge margin must be ≥ 0.");
      break;
    }
    if (r.rotationMode !== "free" && r.rotationMode !== "ninetyOnly") {
      errors.push("Rotation mode is required.");
      break;
    }
  }

  outer: for (let i = 0; i < methodRanges.length; i++) {
    for (let j = i + 1; j < methodRanges.length; j++) {
      const a = methodRanges[i];
      const b = methodRanges[j];
      if (rangesAreDuplicate(a, b)) {
        errors.push("Two rules cannot use the same thickness range.");
        break outer;
      }
      if (
        rangesStrictOverlap(
          a.minThicknessMm,
          a.maxThicknessMm,
          b.minThicknessMm,
          b.maxThicknessMm
        )
      ) {
        const aOpen = a.maxThicknessMm === null;
        const bOpen = b.maxThicknessMm === null;
        if (aOpen || bOpen) {
          errors.push(
            "This overlaps another rule. A band with no upper limit already covers all plate thicknesses. " +
              "Edit or remove that rule first, or set a max thickness on it, then add narrower bands (for example 1–50 mm and 51+ mm)."
          );
        } else {
          errors.push(
            "Thickness ranges cannot overlap. Touching bands are OK (e.g. 1–10 mm and 10–20 mm)."
          );
        }
        break outer;
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Replace all stored ranges (full list across methods). */
export function saveAllCuttingProfileRanges(
  ranges: CuttingProfileRange[]
): void {
  const normalized = ranges.map((r) => normalizeRange(r));
  saveV2(normalized);
}

/** Persist one method’s list; rows for other methods taken from file only (not merged defaults). */
export function saveCuttingProfileRangesForMethod(
  method: CuttingMethod,
  methodRanges: CuttingProfileRange[]
): void {
  const fromFile = loadFileRangesOnly();
  const others = fromFile.filter((r) => r.method !== method);
  const now = new Date().toISOString();
  const indexed = methodRanges.map((r, i) =>
    normalizeRange({
      ...r,
      method,
      sortOrder: i,
      updatedAt: now,
    })
  );
  saveV2([...others, ...indexed]);
}

export function subscribeCuttingProfilesChanged(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE, fn);
  return () => window.removeEventListener(CHANGE, fn);
}
