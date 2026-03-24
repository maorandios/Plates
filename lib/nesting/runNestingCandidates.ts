/**
 * Multi-pass automatic nesting: several part orderings / shuffles, each run through SVGNest
 * with a time slice; best sheet by placed count, utilization, then waste.
 */

import type { NestingEngineDebugMeta } from "@/types";
import type { ProfileRotationMode } from "@/types/production";
import type { NormalizedNestShape } from "./convertGeometryToSvgNest";
import { runSvgNest } from "./runSvgNest";
import { compareSheetMetrics, metricsFromPlacements } from "./scoreNestingResult";
import type { EnginePlacement } from "./shelfNestEngine";

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

export type NestCandidateLabel =
  | "area-desc"
  | "area-asc"
  | "max-side-desc"
  | "perimeter-desc"
  | "reverse-input"
  | "shuffle-1"
  | "shuffle-2";

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
  return 24;
}

/** Two passes balance quality vs total wait time (each run waits for its own SVGNest budget). */
const DEFAULT_CANDIDATES: NestCandidateLabel[] = ["area-desc", "max-side-desc"];

/** If splitting the budget would give less than this per candidate, run a single ordering instead. */
const MIN_MS_PER_CANDIDATE_SLICE = 4500;

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
  candidateLabels?: NestCandidateLabel[];
}

export interface RunNestingCandidatesResult {
  placed: EnginePlacement[];
  debugPatch: Partial<NestingEngineDebugMeta>;
  candidateSummaries: string[];
}

export async function runNestingCandidates(
  options: RunNestingCandidatesOptions
): Promise<RunNestingCandidatesResult> {
  const rawTotal = options.totalBudgetMs;
  const totalBudgetMs =
    Number.isFinite(rawTotal) && rawTotal > 0
      ? Math.min(120_000, Math.max(5_000, rawTotal))
      : 24_000;

  const labels = options.candidateLabels ?? DEFAULT_CANDIDATES;
  const uniq = [...new Set(labels)] as NestCandidateLabel[];
  let labelsToRun = uniq;
  const nAll = Math.max(1, uniq.length);
  let perMs = Math.floor(totalBudgetMs / nAll);
  if (nAll > 1 && perMs < MIN_MS_PER_CANDIDATE_SLICE) {
    labelsToRun = uniq.includes("area-desc")
      ? ["area-desc"]
      : [uniq[0]!];
    perMs = Math.max(2000, totalBudgetMs);
  } else {
    perMs = Math.max(2000, perMs);
  }

  const rotations = svgnestRotationsFromRules(
    options.allowRotation,
    options.rotationMode
  );

  const shapeById = shapeMap(options.normalizedParts);

  let bestPlaced: EnginePlacement[] = [];
  let bestMetrics = metricsFromPlacements(
    [],
    shapeById,
    options.innerBinWidthMm,
    options.innerBinLengthMm
  );
  let winnerLabel: NestCandidateLabel | undefined;
  const candidateSummaries: string[] = [];

  for (const label of labelsToRun) {
    const ordered = orderForLabel(label, options.normalizedParts);
    const run = await runSvgNest({
      normalizedParts: ordered,
      innerBinWidthMm: options.innerBinWidthMm,
      innerBinLengthMm: options.innerBinLengthMm,
      spacingMm: options.spacingMm,
      rotations,
      timeBudgetMs: perMs,
      workerUrl: options.workerUrl,
    });

    const placed = run.placed;
    const m = metricsFromPlacements(
      placed,
      shapeById,
      options.innerBinWidthMm,
      options.innerBinLengthMm
    );
    const warn = run.parseWarnings.filter(Boolean).join("; ") || "—";
    candidateSummaries.push(
      `${label}: placed=${m.placedCount} util=${(m.utilization * 100).toFixed(1)}% ${warn}`
    );

    if (compareSheetMetrics(m, bestMetrics) > 0) {
      bestMetrics = m;
      bestPlaced = placed;
      winnerLabel = label;
    }
    await new Promise((r) => window.setTimeout(r, 0));
  }

  let recoveryRan = false;
  if (
    bestPlaced.length === 0 &&
    options.normalizedParts.length > 0
  ) {
    recoveryRan = true;
    const recoveryBudget = Math.min(
      22_000,
      Math.max(12_000, Math.floor(totalBudgetMs * 0.75))
    );
    const ordered = orderForLabel("area-desc", options.normalizedParts);
    const run = await runSvgNest({
      normalizedParts: ordered,
      innerBinWidthMm: options.innerBinWidthMm,
      innerBinLengthMm: options.innerBinLengthMm,
      spacingMm: options.spacingMm,
      rotations,
      timeBudgetMs: recoveryBudget,
      workerUrl: options.workerUrl,
    });
    const m = metricsFromPlacements(
      run.placed,
      shapeById,
      options.innerBinWidthMm,
      options.innerBinLengthMm
    );
    candidateSummaries.push(
      `recovery(area-desc, ${recoveryBudget}ms): placed=${m.placedCount} util=${(m.utilization * 100).toFixed(1)}% ${run.parseWarnings.join("; ") || "—"}`
    );
    if (compareSheetMetrics(m, bestMetrics) > 0) {
      bestMetrics = m;
      bestPlaced = run.placed;
      winnerLabel = "area-desc";
    }
  }

  const rotationModeApplied: NestingEngineDebugMeta["rotationModeApplied"] =
    !options.allowRotation ? "locked" : options.rotationMode;

  return {
    placed: bestPlaced,
    candidateSummaries,
    debugPatch: {
      primaryAlgorithm: "svgnest-polygon",
      fullPolygonNesting: true,
      totalCandidateRuns: labelsToRun.length + (recoveryRan ? 1 : 0),
      lastWinningCandidateLabel: winnerLabel,
      lastWinningUtilizationPercent: bestMetrics.utilization * 100,
      lastCandidateSummaries: candidateSummaries,
      spacingMmApplied: options.spacingMm,
      edgeMarginMmApplied: options.edgeMarginMm,
      rotationModeApplied,
      rotationsSetting: rotations,
      allowRotationApplied: options.allowRotation,
      shelfFallbackCount: 0,
      shelfFallbackReasons: [],
    },
  };
}
