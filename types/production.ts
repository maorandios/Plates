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

/** Built-in starter bands when no user data exists (mm). */
export const DEFAULT_CUTTING_PROFILE_RANGES: CuttingProfileRange[] = [
  seedRange("seed-laser-0", "laser", 0, 0, 6, 2, 5, true, "ninetyOnly", true, true),
  seedRange("seed-laser-1", "laser", 1, 6, 12, 2.5, 6, true, "ninetyOnly", true, true),
  seedRange("seed-laser-2", "laser", 2, 12, 25, 3, 8, true, "ninetyOnly", true, true),
  seedRange("seed-laser-3", "laser", 3, 25, null, 4, 10, true, "free", true, false),
  seedRange("seed-plasma-0", "plasma", 0, 0, 10, 4, 8, true, "ninetyOnly", true, false),
  seedRange("seed-plasma-1", "plasma", 1, 10, 20, 5, 10, true, "ninetyOnly", true, false),
  seedRange("seed-plasma-2", "plasma", 2, 20, 40, 6, 12, true, "ninetyOnly", true, false),
  seedRange("seed-plasma-3", "plasma", 3, 40, null, 8, 15, true, "free", true, false),
  seedRange("seed-oxy-0", "oxy_fuel", 0, 10, 25, 8, 16, true, "free", true, false),
  seedRange("seed-oxy-1", "oxy_fuel", 1, 25, 50, 10, 18, true, "free", true, false),
  seedRange("seed-oxy-2", "oxy_fuel", 2, 50, null, 12, 22, true, "free", true, false),
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
