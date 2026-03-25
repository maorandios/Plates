import type { NestingEngineDebugMeta, NestingRun, NestingRunMode } from "@/types";
import type { ServerNestingRunResult } from "./serverNestingClient";
import { nanoid } from "@/lib/utils/nanoid";
import { applyPlacementToRing } from "./applyPlacementTransform";

function polygonAreaMm2(ring: [number, number][]): number {
  if (!ring || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function netAreaMm2(
  outer: [number, number][],
  holes: [number, number][][]
): number {
  const outerArea = polygonAreaMm2(outer);
  const holesArea = holes.reduce((sum, h) => sum + polygonAreaMm2(h), 0);
  return Math.max(0, outerArea - holesArea);
}

function mapDebugMeta(
  m: ServerNestingRunResult["debugMetadata"],
  nestingEngine: ServerNestingRunResult["nestingEngine"] | undefined
): NestingEngineDebugMeta {
  const isSvgnest = nestingEngine === "svgnest";
  return {
    primaryAlgorithm: isSvgnest ? "svgnest-nfp-ga" : "heuristic-anchor",
    serverNestingEngine: nestingEngine ?? "heuristic",
    fullPolygonNesting: true,
    totalCandidateRuns: m.candidateAttempts,
    spacingMmApplied: 0,
    edgeMarginMmApplied: 0,
    rotationModeApplied: "locked",
    allowRotationApplied: true,
    shelfFallbackCount: m.fallbackCount,
    shelfFallbackReasons: m.earlyStopReason ? [m.earlyStopReason] : [],
    lastWinningCandidateLabel: m.orderingStrategyUsed,
    placementModeUsed: isSvgnest ? "svgnest-polygon" : "polygon-aware",
    polygonPartsCount: m.polygonPartsCount,
    bboxFallbackPartsCount: m.fallbackCount,
    nestingRunMode: "quick" as NestingRunMode,
    nestingCandidateAttemptsTotal: m.candidateAttempts,
    nestingSimplifyOriginalPointsTotal: m.simplificationOriginalPoints,
    nestingSimplifySimplifiedPointsTotal: m.simplificationSimplifiedPoints,
    nestingSimplifyRatio: m.simplificationRatio,
    nestingEarlyStopReasonLast: m.earlyStopReason,
  };
}

export function mapServerResultToNestingRun(result: ServerNestingRunResult): NestingRun {
  const engine = result.nestingEngine ?? "heuristic";
  const thicknessResults = result.thicknessResults.map((tr) => ({
    thicknessMm: tr.thicknessMm,
    stockSheetsUsed: tr.sheetCount,
    generatedSheets: tr.generatedSheets.map((s) => ({
      id: s.sheetId || nanoid(),
      thicknessMm: tr.thicknessMm,
      stockSheetId: s.stockSheetId,
      stockType: s.stockType,
      widthMm: s.fullWidthMm,
      lengthMm: s.fullHeightMm,
      innerWidthMm: s.widthMm,
      innerLengthMm: s.heightMm,
      placements: s.placements.map((p) => {
        const outerPlaced = applyPlacementToRing(
          p.outerContour,
          p.rotationDeg,
          p.x,
          p.y
        ) as [number, number][];
        const holesPlaced = p.innerContours.map(
          (h) =>
            applyPlacementToRing(h, p.rotationDeg, p.x, p.y) as [number, number][]
        );
        return {
          partInstanceId: p.partInstanceId,
          partId: p.partId,
          partName: p.partName,
          clientId: p.clientId,
          clientCode: p.clientCode,
          x: p.x,
          y: p.y,
          rotation: p.rotationDeg,
          outerContour: outerPlaced,
          innerContours: holesPlaced,
          markingText: p.markingText,
          partNetAreaMm2: netAreaMm2(outerPlaced, holesPlaced),
        };
      }),
      usedAreaMm2: s.usedArea,
      wasteAreaMm2: s.wasteArea,
      utilizationPercent: s.utilization,
    })),
    unplacedParts: tr.unplacedParts.map((u) => ({
      partId: u.partId,
      partName: u.partName,
      clientId: u.clientId,
      clientCode: u.clientCode,
      quantityUnplaced: u.quantityUnplaced,
      reason: u.reason,
    })),
    utilizationPercent: tr.utilization,
    wasteAreaMm2: tr.wasteArea,
    usedAreaMm2: tr.generatedSheets.reduce((sum, g) => sum + g.usedArea, 0),
    warnings: [],
    errors: [],
    engineDebug: mapDebugMeta(tr.debugMetadata, engine),
  }));

  return {
    id: result.jobId,
    batchId: result.batchId,
    createdAt: new Date().toISOString(),
    nestingEngine: engine,
    totalSheets: result.totalSheets,
    totalUtilizationPercent: result.totalUtilization,
    totalWasteAreaMm2: result.totalWasteArea,
    usedAreaMm2: thicknessResults.reduce((sum, t) => sum + t.usedAreaMm2, 0),
    placedPartCount: result.totalPlacedParts,
    unplacedPartCount: result.totalUnplacedParts,
    thicknessResults,
    warnings: result.warnings,
    errors: result.errors,
  };
}
