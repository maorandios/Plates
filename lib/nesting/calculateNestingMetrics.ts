import type { SheetPlacement } from "@/types";

export function sheetInnerMetrics(
  innerWidthMm: number,
  innerLengthMm: number,
  placements: SheetPlacement[]
): {
  usedAreaMm2: number;
  wasteAreaMm2: number;
  utilizationPercent: number;
} {
  const sheetArea = Math.max(0, innerWidthMm) * Math.max(0, innerLengthMm);
  const used = placements.reduce((sum, p) => sum + p.partNetAreaMm2, 0);
  const waste = Math.max(0, sheetArea - used);
  const util = sheetArea > 0 ? (used / sheetArea) * 100 : 0;
  return {
    usedAreaMm2: used,
    wasteAreaMm2: waste,
    utilizationPercent: util,
  };
}
