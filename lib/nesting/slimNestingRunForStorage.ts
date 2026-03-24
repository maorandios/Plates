import type { NestingEngineDebugMeta, NestingRun } from "@/types";

function roundRing(
  ring: [number, number][],
  decimals: number
): [number, number][] {
  const p = 10 ** decimals;
  return ring.map(
    ([x, y]) =>
      [Math.round(x * p) / p, Math.round(y * p) / p] as [number, number]
  );
}

function slimEngineDebug(
  d: NestingEngineDebugMeta | undefined
): NestingEngineDebugMeta | undefined {
  if (!d) return undefined;
  return {
    ...d,
    shelfFallbackReasons: d.shelfFallbackReasons.slice(0, 25),
    lastCandidateSummaries: d.lastCandidateSummaries?.slice(0, 12),
    fallbackPartIds: d.fallbackPartIds?.slice(0, 60),
    svgnestBboxFallbackInstanceIds: d.svgnestBboxFallbackInstanceIds?.slice(0, 60),
  };
}

/**
 * Shrinks nesting JSON before localStorage so saves succeed (quota) and the results page can load.
 */
export function slimNestingRunForStorage(run: NestingRun): NestingRun {
  return {
    ...run,
    warnings: run.warnings.slice(0, 80),
    errors: run.errors.slice(0, 40),
    thicknessResults: run.thicknessResults.map((tr) => ({
      ...tr,
      warnings: tr.warnings.slice(0, 40),
      errors: tr.errors.slice(0, 20),
      engineDebug: slimEngineDebug(tr.engineDebug),
      generatedSheets: tr.generatedSheets.map((s) => ({
        ...s,
        placements: s.placements.map((pl) => ({
          ...pl,
          outerContour: roundRing(pl.outerContour, 3),
          innerContours: pl.innerContours.map((h) => roundRing(h, 3)),
        })),
      })),
    })),
  };
}
