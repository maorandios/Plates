/**
 * Production / cutting configuration — extend here for nesting, spacing, post-process rules.
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

export interface CuttingMethodProductionDefaults {
  defaultSpacingMm: number;
  defaultEdgeMarginMm: number;
}

/**
 * Placeholder defaults for future nesting / CAM screens — not exposed in UI yet.
 */
export const CUTTING_METHOD_DEFAULTS: Record<
  CuttingMethod,
  CuttingMethodProductionDefaults
> = {
  laser: { defaultSpacingMm: 2, defaultEdgeMarginMm: 5 },
  plasma: { defaultSpacingMm: 4, defaultEdgeMarginMm: 8 },
  oxy_fuel: { defaultSpacingMm: 6, defaultEdgeMarginMm: 12 },
};
