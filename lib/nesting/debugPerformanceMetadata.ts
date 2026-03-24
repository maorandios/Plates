/**
 * Merges performance-oriented fields into `NestingEngineDebugMeta`.
 */

import type { NestingEngineDebugMeta, NestingRunMode } from "@/types";

export interface NestingPerformanceStats {
  nestingRunMode?: NestingRunMode;
  nestingTimeBudgetMsPerSheet?: number;
  nestingMaxThicknessBudgetMs?: number;
  nestingThicknessActualRuntimeMs?: number;
  nestingThicknessRemainingBudgetMs?: number;
  nestingCandidateAttemptsTotal?: number;
  nestingEarlyStopReasonLast?: string;
  nestingSimplifyOriginalPointsTotal?: number;
  nestingSimplifySimplifiedPointsTotal?: number;
  nestingSimplifyRatio?: number;
  nestingGeometryCacheHits?: number;
  nestingGeometryCacheMisses?: number;
  nestingReusedFootprintInstances?: number;
  nestingBestCandidateScore?: number;
}

export function mergePerformanceIntoEngineDebug(
  base: NestingEngineDebugMeta,
  perf: NestingPerformanceStats
): NestingEngineDebugMeta {
  return { ...base, ...perf };
}
