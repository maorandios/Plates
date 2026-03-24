/**
 * Runtime presets: **quick** (default production) vs **optimize** (longer search).
 */

import type { NestCandidateLabel } from "./nestingCandidateLabels";
import type { NestingRunMode } from "@/types";
import type { ProfileRotationMode } from "@/types/production";

export type { NestingRunMode };

/** One SVGNest run: part order label + SvgNest `rotations` count (1 = 0° only, 4 = 0/90/180/270). */
export interface SvgnestPlacementAttempt {
  label: NestCandidateLabel;
  /** Passed to svgnest-mjs `config.rotations` (capped at 4 = 90° steps only). */
  svgnestRotations: 1 | 2 | 4;
}

export interface NestingModeRuntimeParams {
  mode: NestingRunMode;
  /** Cap for a single SVGNest invocation (one sheet pack). */
  nestDurationMsPerSheet: number;
  /** Upper bound for all sheets in one thickness group (soft budget). */
  maxThicknessBudgetMs: number;
  /** Multi-pass: sort order + rotation search per attempt. */
  placementAttempts: SvgnestPlacementAttempt[];
  svgnestPopulationSize: number;
  svgnestCurveTolerance: number;
  simplifyToleranceMm: number;
  /**
   * In quick mode, never use more than 4 rotation steps even if rules say `free` (24).
   */
  capRotationsAtFourInQuick: boolean;
  /** Early-stop: stop if utilization unchanged for this long (ms). */
  earlyStopPlateauMs: number;
  /** Early-stop: utilization delta to count as improvement (0–1 scale). */
  earlyStopMinImprovement: number;
}

export function nestingModeRuntimeParams(
  mode: NestingRunMode,
  rotationMode: ProfileRotationMode
): NestingModeRuntimeParams {
  if (mode === "optimize") {
    return {
      mode: "optimize",
      nestDurationMsPerSheet: 24_000,
      maxThicknessBudgetMs: 480_000,
      placementAttempts: [
        { label: "area-desc", svgnestRotations: 1 },
        { label: "area-desc", svgnestRotations: 4 },
        { label: "max-side-desc", svgnestRotations: 4 },
        { label: "perimeter-desc", svgnestRotations: 4 },
        { label: "shuffle-1", svgnestRotations: 4 },
        { label: "shuffle-2", svgnestRotations: 4 },
        { label: "shuffle-3", svgnestRotations: 4 },
      ],
      svgnestPopulationSize: 10,
      svgnestCurveTolerance: 0.06,
      simplifyToleranceMm: rotationMode === "free" ? 0.1 : 0.14,
      capRotationsAtFourInQuick: false,
      earlyStopPlateauMs: 4500,
      earlyStopMinImprovement: 0.002,
    };
  }

  return {
    mode: "quick",
    nestDurationMsPerSheet: 10_000,
    maxThicknessBudgetMs: 120_000,
    placementAttempts: [
      { label: "area-desc", svgnestRotations: 1 },
      { label: "area-desc", svgnestRotations: 4 },
      { label: "max-side-desc", svgnestRotations: 4 },
      { label: "shuffle-1", svgnestRotations: 4 },
    ],
    svgnestPopulationSize: 4,
    svgnestCurveTolerance: 0.14,
    simplifyToleranceMm: 0.28,
    capRotationsAtFourInQuick: true,
    earlyStopPlateauMs: 2200,
    earlyStopMinImprovement: 0.004,
  };
}

/**
 * Legacy fallback when a single rotation count is needed (e.g. recovery).
 * Nesting uses {@link SvgnestPlacementAttempt.svgnestRotations} per pass; **never 24** — only 90° steps.
 */
export function effectiveSvgnestRotations(
  allowRotation: boolean,
  rotationMode: ProfileRotationMode,
  mode: NestingRunMode,
  capRotationsAtFourInQuick: boolean
): number {
  if (!allowRotation) return 1;
  if (rotationMode === "ninetyOnly") return 4;
  if (rotationMode === "free") {
    if (mode === "quick" && capRotationsAtFourInQuick) return 4;
    return 4;
  }
  return 4;
}

/** Clamp attempt rotations: nesting never uses fine (e.g. 24-step) search. */
export function clampAttemptRotations(
  requested: number,
  allowRotation: boolean
): 1 | 2 | 4 {
  if (!allowRotation) return 1;
  if (requested <= 1) return 1;
  if (requested === 2) return 2;
  return 4;
}
