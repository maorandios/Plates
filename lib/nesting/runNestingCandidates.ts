/**
 * Multi-pass SVGNest: several sort orders × rotation settings; best sheet by layout quality
 * (utilization + compact bbox / skyline); bottom-left compaction after each pass.
 */

import type {
  NestingEngineDebugMeta,
  NestingRunMode,
} from "@/types";
import type { ProfileRotationMode } from "@/types/production";
import type { NestingFootprintGeometryCache } from "./cacheNestingGeometry";
import type { NormalizedNestShape } from "./convertGeometryToSvgNest";
import { buildSvgnestPartInputs } from "./buildSvgnestPartInputs";
import type { NestCandidateLabel } from "./nestingCandidateLabels";
import { runSvgNest } from "./runSvgNest";
import {
  compareSheetLayoutQuality,
  layoutQualityFromPlacements,
  scoreLayoutQuality,
} from "./scoreNestingCandidate";
import type { SheetLayoutQuality } from "./scoreNestingResult";
import type { EnginePlacement } from "./shelfNestEngine";
import type { NestingModeRuntimeParams, SvgnestPlacementAttempt } from "./runNestingMode";
import {
  clampAttemptRotations,
  effectiveSvgnestRotations,
} from "./runNestingMode";
import { postProcessSvgnestPlacements } from "./refineSvgnestPlacements";

function shapeMap(list: NormalizedNestShape[]) {
  return new Map(list.map((s) => [s.partInstanceId, s]));
}

function areaAbs(s: NormalizedNestShape) {
  return Math.abs(s.netAreaMm2);
}

function maxSideMm(s: NormalizedNestShape) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of s.outer) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return Math.max(maxX - minX, maxY - minY);
}

function perimeterMm(s: NormalizedNestShape) {
  const o = s.outer;
  if (o.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < o.length; i++) {
    const a = o[i]!;
    const b = o[(i + 1) % o.length]!;
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

export type { NestCandidateLabel } from "./nestingCandidateLabels";

function mulberryShuffle<T>(arr: T[], seed: number): T[] {
  let s = seed >>> 0;
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    const j = ((t ^ (t >>> 14)) >>> 0) % (i + 1);
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function orderForLabel(
  label: NestCandidateLabel,
  parts: NormalizedNestShape[]
): NormalizedNestShape[] {
  const copy = [...parts];
  switch (label) {
    case "area-desc":
      return copy.sort((a, b) => areaAbs(b) - areaAbs(a));
    case "area-asc":
      return copy.sort((a, b) => areaAbs(a) - areaAbs(b));
    case "max-side-desc":
      return copy.sort((a, b) => maxSideMm(b) - maxSideMm(a));
    case "perimeter-desc":
      return copy.sort((a, b) => perimeterMm(b) - perimeterMm(a));
    case "reverse-input":
      return copy.reverse();
    case "shuffle-1":
      return mulberryShuffle(copy, 0x9e3779b1);
    case "shuffle-2":
      return mulberryShuffle(copy, 0x6a09e667);
    case "shuffle-3":
      return mulberryShuffle(copy, 0x243f6a88);
    default:
      return copy;
  }
}

/** Maps cutting rules to SvgNest `rotations` (steps around 360°). */
export function svgnestRotationsFromRules(
  allowRotation: boolean,
  rotationMode: ProfileRotationMode
): number {
  if (!allowRotation) return 1;
  if (rotationMode === "ninetyOnly") return 4;
  return 4;
}

const DEFAULT_ATTEMPTS: SvgnestPlacementAttempt[] = [
  { label: "area-desc", svgnestRotations: 1 },
  { label: "area-desc", svgnestRotations: 4 },
];

const SVGNEST_RECOVERY_PASS = false;

const MIN_MS_PER_ATTEMPT = 2200;
const MAX_POST_PROCESS_PARTS = 20;

export interface RunNestingCandidatesOptions {
  normalizedParts: NormalizedNestShape[];
  innerBinWidthMm: number;
  innerBinLengthMm: number;
  spacingMm: number;
  edgeMarginMm: number;
  allowRotation: boolean;
  rotationMode: ProfileRotationMode;
  totalBudgetMs: number;
  workerUrl: string;
  nestingRunMode: NestingRunMode;
  modeParams: NestingModeRuntimeParams;
  footprintCache?: NestingFootprintGeometryCache;
}

export interface RunNestingCandidatesResult {
  placed: EnginePlacement[];
  debugPatch: Partial<NestingEngineDebugMeta>;
  candidateSummaries: string[];
  svgnestWallTimeMs: number;
  svgnestInputFootprint: {
    polygonCount: number;
    bboxFallbackCount: number;
    bboxFallbackInstanceIds: string[];
  };
  footprintStats: {
    simplifyOriginalPointsTotal: number;
    simplifySimplifiedPointsTotal: number;
    reusedInstanceCount: number;
  };
}

function resolveAttempts(
  mp: NestingModeRuntimeParams,
  allowRotation: boolean
): SvgnestPlacementAttempt[] {
  const raw =
    mp.placementAttempts?.length > 0 ? mp.placementAttempts : DEFAULT_ATTEMPTS;
  if (!allowRotation) {
    return raw.map((a) => ({ ...a, svgnestRotations: 1 }));
  }
  return raw.map((a) => ({
    ...a,
    svgnestRotations: clampAttemptRotations(a.svgnestRotations, true),
  }));
}

export async function runNestingCandidates(
  options: RunNestingCandidatesOptions
): Promise<RunNestingCandidatesResult> {
  const rawTotal = options.totalBudgetMs;
  const totalBudgetMs =
    Number.isFinite(rawTotal) && rawTotal > 0
      ? Math.min(120_000, Math.max(2_000, rawTotal))
      : 8_000;

  const mp = options.modeParams;
  let attemptsToRun = resolveAttempts(mp, options.allowRotation);
  const nAll = Math.max(1, attemptsToRun.length);
  let perMs = Math.floor(totalBudgetMs / nAll);
  if (nAll > 1 && perMs < MIN_MS_PER_ATTEMPT) {
    attemptsToRun = attemptsToRun.slice(0, 1);
    if (attemptsToRun[0]!.label !== "area-desc") {
      attemptsToRun = [{ label: "area-desc", svgnestRotations: 4 }];
    } else {
      attemptsToRun = [{ ...attemptsToRun[0]! }];
    }
    perMs = Math.max(MIN_MS_PER_ATTEMPT, totalBudgetMs);
  } else {
    perMs = Math.max(MIN_MS_PER_ATTEMPT, perMs);
  }

  const normalizedSorted = [...options.normalizedParts].sort(
    (a, b) => areaAbs(b) - areaAbs(a)
  );

  const shapeById = shapeMap(options.normalizedParts);

  const svgnestFootprint = buildSvgnestPartInputs(
    normalizedSorted,
    options.spacingMm,
    undefined,
    {
      simplifyToleranceMm: mp.simplifyToleranceMm,
      footprintCache: options.footprintCache,
    }
  );
  const partInputByInstanceId = new Map(
    svgnestFootprint.parts.map((p) => [p.shape.partInstanceId, p])
  );

  let bestPlaced: EnginePlacement[] = [];
  let bestLayout = layoutQualityFromPlacements(
    [],
    shapeById,
    options.innerBinWidthMm,
    options.innerBinLengthMm
  );
  let winnerKey = "";
  const candidateSummaries: string[] = [];
  let svgnestWallTimeMs = 0;
  let lastEarlyStop: string | undefined;
  let winnerRotations = 1;

  for (const attempt of attemptsToRun) {
    await new Promise((r) => window.setTimeout(r, 0));
    const ordered = orderForLabel(attempt.label, normalizedSorted);
    const partsForNest = ordered
      .map((s) => partInputByInstanceId.get(s.partInstanceId))
      .filter((p): p is NonNullable<typeof p> => p != null);

    const rot = options.allowRotation
      ? clampAttemptRotations(attempt.svgnestRotations, true)
      : 1;

    const run = await runSvgNest({
      parts: partsForNest,
      innerBinWidthMm: options.innerBinWidthMm,
      innerBinLengthMm: options.innerBinLengthMm,
      spacingMm: 0,
      rotations: rot,
      timeBudgetMs: perMs,
      workerUrl: options.workerUrl,
      populationSize: mp.svgnestPopulationSize,
      mutationRate: mp.mode === "quick" ? 8 : 10,
      curveTolerance: mp.svgnestCurveTolerance,
      earlyStop: {
        enabled: true,
        stopWhenAllPlaced: true,
        plateauMs: mp.earlyStopPlateauMs,
        minUtilizationImprovement: mp.earlyStopMinImprovement,
        minRunMsBeforePlateauCheck: mp.mode === "quick" ? 2200 : 3000,
      },
    });

    svgnestWallTimeMs += run.actualRuntimeMs ?? 0;
    if (run.earlyStopReason) lastEarlyStop = run.earlyStopReason;

    let placed = run.placed;
    if (placed.length > 0) {
      const placedIds = new Set(placed.map((p) => p.id));
      const unplacedForPass = normalizedSorted.filter(
        (s) => !placedIds.has(s.partInstanceId)
      );
      if (placed.length <= MAX_POST_PROCESS_PARTS) {
        placed = postProcessSvgnestPlacements(placed, {
          shapeById,
          innerW: options.innerBinWidthMm,
          innerL: options.innerBinLengthMm,
          spacingMm: options.spacingMm,
          allowRotation: options.allowRotation,
          unplacedShapes: unplacedForPass,
        });
      }
    }

    const L = layoutQualityFromPlacements(
      placed,
      shapeById,
      options.innerBinWidthMm,
      options.innerBinLengthMm
    );
    const warn = run.parseWarnings.filter(Boolean).join("; ") || "—";
    const key = `${attempt.label}|r=${rot}`;
    candidateSummaries.push(
      `${key}: placed=${L.placedCount} util=${(L.utilization * 100).toFixed(1)}% bbox=${(L.layoutBBoxAreaMm2 / 1e6).toFixed(3)}M yMax=${L.layoutMaxYmm.toFixed(0)} ~${run.actualRuntimeMs ?? "?"}ms es=${run.earlyStopReason ?? "—"} ${warn}`
    );

    if (compareSheetLayoutQuality(L, bestLayout) > 0) {
      bestLayout = L;
      bestPlaced = placed;
      winnerKey = key;
      winnerRotations = rot;
    }
    await new Promise((r) => window.setTimeout(r, 0));
  }

  let recoveryRan = false;
  const recoveryRotations = effectiveSvgnestRotations(
    options.allowRotation,
    options.rotationMode,
    options.nestingRunMode,
    mp.capRotationsAtFourInQuick
  );

  if (
    SVGNEST_RECOVERY_PASS &&
    bestPlaced.length === 0 &&
    options.normalizedParts.length > 0
  ) {
    await new Promise((r) => window.setTimeout(r, 0));
    recoveryRan = true;
    const recoveryBudget = Math.min(
      22_000,
      Math.max(12_000, Math.floor(totalBudgetMs * 0.75))
    );
    const ordered = orderForLabel("area-desc", normalizedSorted);
    const partsForNest = ordered
      .map((s) => partInputByInstanceId.get(s.partInstanceId))
      .filter((p): p is NonNullable<typeof p> => p != null);
    const run = await runSvgNest({
      parts: partsForNest,
      innerBinWidthMm: options.innerBinWidthMm,
      innerBinLengthMm: options.innerBinLengthMm,
      spacingMm: 0,
      rotations: recoveryRotations,
      timeBudgetMs: recoveryBudget,
      workerUrl: options.workerUrl,
      populationSize: options.modeParams.svgnestPopulationSize,
      curveTolerance: options.modeParams.svgnestCurveTolerance,
      earlyStop: {
        enabled: true,
        stopWhenAllPlaced: true,
        plateauMs: options.modeParams.earlyStopPlateauMs,
        minUtilizationImprovement: options.modeParams.earlyStopMinImprovement,
        minRunMsBeforePlateauCheck: 3000,
      },
    });
    let placed = run.placed;
    if (placed.length > 0) {
      const placedIdsR = new Set(placed.map((p) => p.id));
      const unplacedR = normalizedSorted.filter(
        (s) => !placedIdsR.has(s.partInstanceId)
      );
      if (placed.length <= MAX_POST_PROCESS_PARTS) {
        placed = postProcessSvgnestPlacements(placed, {
          shapeById,
          innerW: options.innerBinWidthMm,
          innerL: options.innerBinLengthMm,
          spacingMm: options.spacingMm,
          allowRotation: options.allowRotation,
          unplacedShapes: unplacedR,
        });
      }
    }
    const L = layoutQualityFromPlacements(
      placed,
      shapeById,
      options.innerBinWidthMm,
      options.innerBinLengthMm
    );
    candidateSummaries.push(
      `recovery(area-desc|r=${recoveryRotations}, ${recoveryBudget}ms): placed=${L.placedCount} util=${(L.utilization * 100).toFixed(1)}% ${run.parseWarnings.join("; ") || "—"}`
    );
    if (compareSheetLayoutQuality(L, bestLayout) > 0) {
      bestLayout = L;
      bestPlaced = placed;
      winnerKey = "recovery";
      winnerRotations = recoveryRotations;
    }
  }

  const rotationModeApplied: NestingEngineDebugMeta["rotationModeApplied"] =
    !options.allowRotation ? "locked" : options.rotationMode;

  const fs = svgnestFootprint.footprintStats;
  const simplifyRatio =
    fs.simplifyOriginalPointsTotal > 0
      ? fs.simplifySimplifiedPointsTotal / fs.simplifyOriginalPointsTotal
      : 1;
  const cache = options.footprintCache;

  return {
    placed: bestPlaced,
    candidateSummaries,
    svgnestWallTimeMs,
    svgnestInputFootprint: {
      polygonCount: svgnestFootprint.polygonCount,
      bboxFallbackCount: svgnestFootprint.bboxFallbackCount,
      bboxFallbackInstanceIds: svgnestFootprint.bboxFallbackInstanceIds,
    },
    footprintStats: fs,
    debugPatch: {
      primaryAlgorithm: "svgnest-polygon",
      fullPolygonNesting: true,
      totalCandidateRuns: attemptsToRun.length + (recoveryRan ? 1 : 0),
      lastWinningPlacementAttemptKey: winnerKey || undefined,
      lastWinningCandidateLabel: winnerKey
        ? winnerKey === "recovery"
          ? "area-desc"
          : (winnerKey.split("|")[0] as NestCandidateLabel)
        : undefined,
      lastWinningUtilizationPercent: bestLayout.utilization * 100,
      lastCandidateSummaries: candidateSummaries,
      spacingMmApplied: options.spacingMm,
      edgeMarginMmApplied: options.edgeMarginMm,
      rotationModeApplied,
      rotationsSetting: winnerRotations,
      allowRotationApplied: options.allowRotation,
      shelfFallbackCount: 0,
      shelfFallbackReasons: [],
      svgnestSpacingInConfigMm: 0,
      svgnestInputPolygonCount: svgnestFootprint.polygonCount,
      svgnestInputBboxFallbackCount: svgnestFootprint.bboxFallbackCount,
      svgnestBboxFallbackInstanceIds: svgnestFootprint.bboxFallbackInstanceIds,
      nestingRunMode: options.nestingRunMode,
      nestingTimeBudgetMsPerSheet: totalBudgetMs,
      nestingEarlyStopReasonLast: lastEarlyStop,
      nestingSimplifyOriginalPointsTotal: fs.simplifyOriginalPointsTotal,
      nestingSimplifySimplifiedPointsTotal: fs.simplifySimplifiedPointsTotal,
      nestingSimplifyRatio: Math.round(simplifyRatio * 1000) / 1000,
      nestingGeometryCacheHits: cache?.hits,
      nestingGeometryCacheMisses: cache?.misses,
      nestingReusedFootprintInstances: fs.reusedInstanceCount,
      nestingBestCandidateScore: scoreLayoutQuality(bestLayout),
    },
  };
}
