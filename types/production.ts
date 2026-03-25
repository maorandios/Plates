/**
 * Production / cutting configuration — nesting rules, spacing, CAM-related defaults.
 */

export type CuttingMethod = "laser" | "plasma" | "oxy_fuel";

export const CUTTING_METHOD_LABELS: Record<CuttingMethod, string> = {
  laser: "Laser",
  plasma: "Plasma",
  oxy_fuel: "Oxy-fuel",
};

/** Ordered for selects */
export const CUTTING_METHOD_OPTIONS: CuttingMethod[] = [
  "laser",
  "plasma",
  "oxy_fuel",
];

/** Rotation constraint for nesting (stored on each thickness-range rule). */
export type ProfileRotationMode = "ninetyOnly" | "free";

export const PROFILE_ROTATION_MODE_LABELS: Record<ProfileRotationMode, string> = {
  ninetyOnly: "90° only",
  free: "Free rotation",
};

/** @deprecated Use ProfileRotationMode */
export type RotationMode = ProfileRotationMode;

/** @deprecated Use PROFILE_ROTATION_MODE_LABELS */
export const ROTATION_MODE_LABELS = PROFILE_ROTATION_MODE_LABELS;

/**
 * Company default nesting behavior for one cutting method and a thickness band.
 * All lengths in mm internally; maxThicknessMm null = no upper limit (“and above”).
 */
export interface CuttingProfileRange {
  id: string;
  method: CuttingMethod;
  minThicknessMm: number;
  maxThicknessMm: number | null;
  defaultSpacingMm: number;
  defaultEdgeMarginMm: number;
  allowRotation: boolean;
  rotationMode: ProfileRotationMode;
  defaultMarkPartName: boolean;
  defaultIncludeClientCode: boolean;
  sortOrder: number;
  updatedAt: string;
}

/** Subset for legacy / simple lookups (first thin band per method). */
export interface CuttingMethodProductionDefaults {
  defaultSpacingMm: number;
  defaultEdgeMarginMm: number;
}

const ISO_MIN = "1970-01-01T00:00:00.000Z";

function seedRange(
  id: string,
  method: CuttingMethod,
  sortOrder: number,
  minThicknessMm: number,
  maxThicknessMm: number | null,
  defaultSpacingMm: number,
  defaultEdgeMarginMm: number,
  allowRotation: boolean,
  rotationMode: ProfileRotationMode,
  defaultMarkPartName: boolean,
  defaultIncludeClientCode: boolean
): CuttingProfileRange {
  return {
    id,
    method,
    minThicknessMm,
    maxThicknessMm,
    defaultSpacingMm,
    defaultEdgeMarginMm,
    allowRotation,
    rotationMode,
    defaultMarkPartName,
    defaultIncludeClientCode,
    sortOrder,
    updatedAt: ISO_MIN,
  };
}

/** Default max (mm) for the starter thickness band (1 mm … this value). User can add 100+ mm etc. later. */
export const DEFAULT_THICKNESS_BAND_MAX_MM = 100;

/**
 * Built-in starter bands when no user data exists (mm).
 * One band per cutting method: 1–100 mm; users can add more rows (e.g. 100 mm and up).
 */
export const DEFAULT_CUTTING_PROFILE_RANGES: CuttingProfileRange[] = [
  seedRange(
    "seed-laser-0",
    "laser",
    0,
    1,
    DEFAULT_THICKNESS_BAND_MAX_MM,
    2,
    5,
    true,
    "ninetyOnly",
    true,
    false
  ),
  seedRange(
    "seed-plasma-0",
    "plasma",
    0,
    1,
    DEFAULT_THICKNESS_BAND_MAX_MM,
    4,
    8,
    true,
    "ninetyOnly",
    true,
    false
  ),
  seedRange(
    "seed-oxy-0",
    "oxy_fuel",
    0,
    1,
    DEFAULT_THICKNESS_BAND_MAX_MM,
    8,
    16,
    true,
    "free",
    true,
    false
  ),
];

function firstRangeForMethod(m: CuttingMethod): CuttingProfileRange | undefined {
  return DEFAULT_CUTTING_PROFILE_RANGES.filter((r) => r.method === m).sort(
    (a, b) => a.sortOrder - b.sortOrder
  )[0];
}

/** @deprecated Use thickness-range profiles; kept for older call sites */
export const CUTTING_METHOD_DEFAULTS: Record<
  CuttingMethod,
  CuttingMethodProductionDefaults
> = {
  laser: {
    defaultSpacingMm: firstRangeForMethod("laser")?.defaultSpacingMm ?? 2,
    defaultEdgeMarginMm: firstRangeForMethod("laser")?.defaultEdgeMarginMm ?? 5,
  },
  plasma: {
    defaultSpacingMm: firstRangeForMethod("plasma")?.defaultSpacingMm ?? 4,
    defaultEdgeMarginMm: firstRangeForMethod("plasma")?.defaultEdgeMarginMm ?? 8,
  },
  oxy_fuel: {
    defaultSpacingMm: firstRangeForMethod("oxy_fuel")?.defaultSpacingMm ?? 8,
    defaultEdgeMarginMm: firstRangeForMethod("oxy_fuel")?.defaultEdgeMarginMm ?? 16,
  },
};
