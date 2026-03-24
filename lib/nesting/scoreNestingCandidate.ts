/**
 * Numeric scoring for nesting candidates (debug / comparison).
 */

import type {
  SheetLayoutQuality,
  SheetNestingMetrics,
} from "./scoreNestingResult";

export {
  compareSheetLayoutQuality,
  compareSheetMetrics,
  layoutQualityFromPlacements,
  metricsFromPlacements,
} from "./scoreNestingResult";
export type { SheetLayoutQuality, SheetNestingMetrics } from "./scoreNestingResult";

/**
 * Higher is better. Uses placed count, utilization, then waste (lower waste → higher score).
 */
export function scoreSheetMetrics(m: SheetNestingMetrics): number {
  const u = Math.max(0, Math.min(1, m.utilization));
  const wastePenalty = m.sheetAreaMm2 > 0 ? m.wasteAreaMm2 / m.sheetAreaMm2 : 1;
  return m.placedCount * 1_000_000 + u * 10_000 - wastePenalty * 100;
}

/** Rewards compact layouts (tight bbox, low skyline, less void). */
export function scoreLayoutQuality(m: SheetLayoutQuality): number {
  const u = Math.max(0, Math.min(1, m.utilization));
  const sheet = Math.max(1, m.sheetAreaMm2);
  const bboxPen =
    m.layoutBBoxAreaMm2 > 0 ? m.layoutBBoxAreaMm2 / sheet : 1;
  const skyPen =
    m.innerLengthMm > 0 ? m.layoutMaxYmm / m.innerLengthMm : 1;
  const voidPen = m.internalVoidMm2 / sheet;
  const channelPen =
    (m.horizontalChannelMm2 + m.verticalChannelMm2) / sheet;
  const rightPen = m.rightStripWasteMm2 / sheet;
  const fragPen = m.voidFragmentationScore / (sheet / 1e4 + 1);
  return (
    m.placedCount * 2_000_000 +
    u * 25_000 -
    bboxPen * 8_000 -
    skyPen * 6_000 -
    voidPen * 4_000 -
    channelPen * 5_000 -
    rightPen * 3_500 -
    fragPen * 120 -
    (m.wasteAreaMm2 / sheet) * 2_000
  );
}
