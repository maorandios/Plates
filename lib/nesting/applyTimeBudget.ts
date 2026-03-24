/**
 * Time budget helpers for nesting (per sheet vs per thickness).
 */

export function clampSheetTimeBudgetMs(
  requestedMs: number,
  remainingThicknessMs: number,
  absoluteMinMs: number,
  absoluteMaxMs: number
): number {
  const cap = Math.min(absoluteMaxMs, Math.max(absoluteMinMs, requestedMs));
  if (remainingThicknessMs <= 0) return absoluteMinMs;
  return Math.min(cap, Math.max(absoluteMinMs, remainingThicknessMs));
}
