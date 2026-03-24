import type { NormalizedNestShape } from "./convertGeometryToSvgNest";
import type { EnginePlacement } from "./shelfNestEngine";

export interface SheetNestingMetrics {
  placedCount: number;
  utilization: number;
  wasteAreaMm2: number;
  sheetAreaMm2: number;
  usedAreaMm2: number;
}

export function metricsFromPlacements(
  placed: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>,
  innerWidthMm: number,
  innerLengthMm: number
): SheetNestingMetrics {
  const sheetAreaMm2 = innerWidthMm * innerLengthMm;
  let usedAreaMm2 = 0;
  for (const p of placed) {
    usedAreaMm2 += shapeById.get(p.id)?.netAreaMm2 ?? 0;
  }
  const utilization =
    sheetAreaMm2 > 0 ? usedAreaMm2 / sheetAreaMm2 : 0;
  return {
    placedCount: placed.length,
    utilization,
    wasteAreaMm2: Math.max(0, sheetAreaMm2 - usedAreaMm2),
    sheetAreaMm2,
    usedAreaMm2,
  };
}

/** Returns positive if `a` is strictly better than `b`. */
export function compareSheetMetrics(a: SheetNestingMetrics, b: SheetNestingMetrics): number {
  if (a.placedCount !== b.placedCount) return a.placedCount - b.placedCount;
  if (Math.abs(a.utilization - b.utilization) > 1e-9) {
    return a.utilization > b.utilization ? 1 : -1;
  }
  return a.wasteAreaMm2 < b.wasteAreaMm2 ? 1 : -1;
}
