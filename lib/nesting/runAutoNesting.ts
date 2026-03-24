/**
 * Auto nesting — thickness-first. **Default: SVGNest** (`runNestingCandidates`): true polygon
 * footprints (cleaned outer + outward spacing offset in SVG), inner bin from stock minus edge
 * margin, multi-candidate passes. Placements map to **original** `outer`/`holes` for the viewer.
 * **Shelf** runs only when the worker is unavailable or SVGNest places nothing.
 *
 * Stock strategy (MVP, documented):
 * - Stock rows are individual physical sheets (no quantity field).
 * - Sheets are grouped by (thickness, widthMm, lengthMm).
 * - Groups are processed in descending sheet area (largest bins first).
 * - For each group, sheets are consumed in array order while parts remain.
 * - Each nesting call packs into that bin geometry; we consume one stock row per filled sheet.
 * - If parts remain after real rows are used, we add **implicit** sheets of the same size (capped)
 *   so nesting can finish; a warning asks the user to add matching rows in Stock for accuracy.
 */

import type {
  Batch,
  GeneratedSheet,
  NestingEngineDebugMeta,
  NestingRun,
  NestingRunMode,
  NestingThicknessResult,
  SheetPlacement,
  StockSheetEntry,
  UnplacedPart,
} from "@/types";
import type { UnitSystem } from "@/types/settings";
import { nanoid } from "@/lib/utils/nanoid";
import { getBatchById, getStockSheetsByBatch } from "@/lib/store";
import { sheetInnerMetrics } from "./calculateNestingMetrics";
import { buildPolygonPlacementDebugFields } from "./debugPlacementMetadata";
import {
  normalizeShapeForNest,
  type NormalizedNestShape,
} from "./convertGeometryToSvgNest";
import type { NestablePartInstance } from "./expandPartInstances";
import { sheetPlacementFromEnginePlacement } from "./mapPlacementResults";
import {
  adaptNormalizedShapesForPolygonPlacement,
  packPolygonAwareShelfSingleSheetBestWithOrientation,
} from "./runPolygonAwarePlacement";
import {
  packShelfSingleSheetBestWithOrientation as packAabbShelfSingleSheetBestWithOrientation,
  rotationAnglesDeg,
  type EnginePlacement,
} from "./shelfNestEngine";
import { prepareNestingInputs } from "./prepareNestingInputs";
import { resolveNestRulesForThickness } from "./resolveBatchThicknessRules";
import { clampSheetTimeBudgetMs } from "./applyTimeBudget";
import { NestingFootprintGeometryCache } from "./cacheNestingGeometry";
import { runNestingCandidates } from "./runNestingCandidates";
import { resolveSvgnestWorkerUrlClient } from "./resolveSvgnestWorkerUrl";
import { innerBinDimensionsMm } from "./resolveBinGeometry";
import { nestingModeRuntimeParams } from "./runNestingMode";
import { thicknessGroupKey } from "./stockConfiguration";

const POLYGON_SHELF_MAX_PARTS = 26;
const POLYGON_SHELF_MAX_ANGLE_COUNT = 4;

/** Lets the browser paint loading state and stay responsive between heavy steps. */
async function yieldToUi(): Promise<void> {
  if (typeof window === "undefined") return;
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

export interface RunAutoNestingOptions {
  batchId: string;
  unitSystem: UnitSystem;
  /**
   * Overrides per-sheet SVGNest time cap from {@link NestingRunMode} presets when set.
   */
  nestDurationMs?: number;
  /** Default `quick` (fast); `optimize` runs longer with more candidates. */
  nestingRunMode?: NestingRunMode;
  /**
   * When true (default), run SVGNest in the browser when the worker loads; otherwise shelf only.
   */
  usePolygonNesting?: boolean;
}

function stockGroupsForThickness(
  batchId: string,
  thicknessMm: number | null
): { widthMm: number; lengthMm: number; area: number; entries: StockSheetEntry[] }[] {
  const key = thicknessGroupKey(thicknessMm);
  const rows = getStockSheetsByBatch(batchId).filter(
    (s) =>
      s.enabled &&
      s.widthMm > 0 &&
      s.lengthMm > 0 &&
      thicknessGroupKey(s.thicknessMm) === key
  );
  const map = new Map<
    string,
    { widthMm: number; lengthMm: number; entries: StockSheetEntry[] }
  >();
  for (const s of rows) {
    const gk = `${s.widthMm}x${s.lengthMm}`;
    const cur = map.get(gk);
    if (cur) {
      cur.entries.push(s);
    } else {
      map.set(gk, {
        widthMm: s.widthMm,
        lengthMm: s.lengthMm,
        entries: [s],
      });
    }
  }
  const groups = [...map.values()].map((g) => ({
    ...g,
    area: g.widthMm * g.lengthMm,
  }));
  groups.sort((a, b) => b.area - a.area);
  return groups;
}

function shapeMapFromNormalized(
  list: NormalizedNestShape[]
): Map<string, NormalizedNestShape> {
  const m = new Map<string, NormalizedNestShape>();
  for (const n of list) {
    m.set(n.partInstanceId, n);
  }
  return m;
}

function generatedSheetFromBin(
  stock: StockSheetEntry,
  thicknessMm: number | null,
  innerW: number,
  innerL: number,
  binPlacements: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>
): GeneratedSheet {
  const placements: SheetPlacement[] = [];
  for (const pl of binPlacements) {
    if (!pl) continue;
    const sh = shapeById.get(pl.id);
    if (!sh) continue;
    placements.push(
      sheetPlacementFromEnginePlacement(pl, sh, {
        innerWidthMm: innerW,
        innerLengthMm: innerL,
      })
    );
  }
  const m = sheetInnerMetrics(innerW, innerL, placements);
  return {
    id: nanoid(),
    thicknessMm,
    stockSheetId: stock.id,
    stockType: stock.type,
    widthMm: stock.widthMm,
    lengthMm: stock.lengthMm,
    innerWidthMm: innerW,
    innerLengthMm: innerL,
    placements,
    usedAreaMm2: m.usedAreaMm2,
    wasteAreaMm2: m.wasteAreaMm2,
    utilizationPercent: m.utilizationPercent,
  };
}

function aggregateUnplaced(
  instances: NestablePartInstance[],
  reason: string
): UnplacedPart[] {
  const map = new Map<
    string,
    { name: string; clientId: string; clientCode: string; n: number }
  >();
  for (const i of instances) {
    const cur = map.get(i.partId);
    if (cur) cur.n += 1;
    else
      map.set(i.partId, {
        name: i.partName,
        clientId: i.clientId,
        clientCode: i.clientCode,
        n: 1,
      });
  }
  return [...map.entries()].map(([partId, v]) => ({
    partId,
    partName: v.name,
    clientId: v.clientId,
    clientCode: v.clientCode,
    quantityUnplaced: v.n,
    reason,
  }));
}

async function nestThicknessGroup(
  batch: Batch,
  thicknessMm: number | null,
  instances: NestablePartInstance[],
  unitSystem: UnitSystem,
  nestingRunMode: NestingRunMode,
  nestDurationMsOverride: number | undefined,
  usePolygonNesting: boolean
): Promise<NestingThicknessResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const generatedSheets: GeneratedSheet[] = [];
  let unplaced: NestablePartInstance[] = [...instances];

  const rules = resolveNestRulesForThickness(batch, thicknessMm, unitSystem);
  const margin = Math.max(0, rules.edgeMarginMm);
  const spacing = Math.max(0, rules.spacingMm);
  const nestingModeParams = nestingModeRuntimeParams(
    nestingRunMode,
    rules.rotationMode
  );
  const sheetCapMs =
    nestDurationMsOverride ?? nestingModeParams.nestDurationMsPerSheet;
  let remainingThicknessMs = nestingModeParams.maxThicknessBudgetMs;
  const geometryCache = new NestingFootprintGeometryCache();
  let thicknessPackWallMs = 0;
  let sumSimplifyOrig = 0;
  let sumSimplifySimplified = 0;
  let sumFootprintReuse = 0;

  let anySvgNestSheet = false;
  const engineDebug: NestingEngineDebugMeta = {
    primaryAlgorithm: usePolygonNesting ? "svgnest-polygon" : "shelf-fallback",
    fullPolygonNesting: false,
    totalCandidateRuns: 0,
    spacingMmApplied: spacing,
    edgeMarginMmApplied: margin,
    rotationModeApplied: !rules.allowRotation ? "locked" : rules.rotationMode,
    allowRotationApplied: rules.allowRotation,
    shelfFallbackCount: 0,
    shelfFallbackReasons: [],
    nestingRunMode,
    nestingMaxThicknessBudgetMs: nestingModeParams.maxThicknessBudgetMs,
    nestingTimeBudgetMsPerSheet: sheetCapMs,
  };

  const stockGroups = stockGroupsForThickness(batch.id, thicknessMm);

  await yieldToUi();

  let effectiveSvgnestWorkerUrl = "";
  if (usePolygonNesting && typeof window !== "undefined") {
    effectiveSvgnestWorkerUrl = (await resolveSvgnestWorkerUrlClient()) ?? "";
    if (!effectiveSvgnestWorkerUrl) {
      warnings.push(
        "Polygon nesting requested but SVGNest worker could not be loaded — using shelf packing."
      );
    }
  }

  if (stockGroups.length === 0) {
    errors.push(
      `No enabled stock sheets for thickness group “${thicknessGroupKey(thicknessMm)}”.`
    );
    return {
      thicknessMm,
      stockSheetsUsed: 0,
      generatedSheets: [],
      unplacedParts: aggregateUnplaced(
        unplaced,
        "No stock sheet configured for this thickness."
      ),
      utilizationPercent: 0,
      wasteAreaMm2: 0,
      usedAreaMm2: 0,
      warnings,
      errors,
      engineDebug: {
        ...engineDebug,
        primaryAlgorithm: "shelf-fallback",
        fullPolygonNesting: false,
        shelfFallbackReasons: [
          "No enabled stock for this thickness — no SVGNest run.",
        ],
      },
    };
  }

  const MAX_IMPLICIT_SHEETS_PER_SIZE = 500;
  let implicitSheetsThisThickness = 0;
  let shelfAdaptMaxPolygon = 0;
  let shelfAdaptMaxBbox = 0;
  const shelfPolygonFallbackIds = new Set<string>();
  let maxSvgnestPlannedParts = 0;

  for (const sg of stockGroups) {
    const pool = [...sg.entries];
    const innerDims = innerBinDimensionsMm(sg.widthMm, sg.lengthMm, margin);
    if (!innerDims) {
      warnings.push(
        `Stock ${sg.widthMm}×${sg.lengthMm} mm: inner bin non-positive after ${margin} mm edge margin — skipped.`
      );
      continue;
    }
    const { innerWidthMm: innerW, innerLengthMm: innerL } = innerDims;
    let implicitForThisGroup = 0;

    while (unplaced.length > 0) {
      await yieldToUi();
      const hasRealSheet = pool.length > 0;
      const canUseImplicit =
        !hasRealSheet &&
        sg.entries.length > 0 &&
        implicitForThisGroup < MAX_IMPLICIT_SHEETS_PER_SIZE &&
        implicitSheetsThisThickness < MAX_IMPLICIT_SHEETS_PER_SIZE;

      if (!hasRealSheet && !canUseImplicit) {
        break;
      }
      const pairs = unplaced.map((u) => ({
        u,
        n: normalizeShapeForNest(u),
      }));
      const failedNorm = pairs.filter((p) => !p.n).map((p) => p.u);
      const normalized = pairs
        .filter((p): p is { u: NestablePartInstance; n: NormalizedNestShape } => p.n != null)
        .map((p) => p.n);
      const okInstances = pairs.filter((p) => p.n).map((p) => p.u);

      if (normalized.length === 0) {
        if (failedNorm.length > 0) {
          warnings.push(
            "Some part instances could not be normalized for nesting (invalid outer contour)."
          );
        }
        unplaced = [...failedNorm, ...okInstances];
        break;
      }

      const shapeById = shapeMapFromNormalized(normalized);

      let packPlaced: EnginePlacement[] = [];
      let usedPolygonPath = false;

      if (usePolygonNesting && effectiveSvgnestWorkerUrl) {
        try {
          const sheetBudget = clampSheetTimeBudgetMs(
            sheetCapMs,
            remainingThicknessMs,
            2000,
            120_000
          );
          const tPack = Date.now();
          const candidates = await runNestingCandidates({
            normalizedParts: normalized,
            innerBinWidthMm: innerW,
            innerBinLengthMm: innerL,
            spacingMm: spacing,
            edgeMarginMm: margin,
            allowRotation: rules.allowRotation,
            rotationMode: rules.rotationMode,
            totalBudgetMs: sheetBudget,
            workerUrl: effectiveSvgnestWorkerUrl,
            nestingRunMode,
            modeParams: nestingModeParams,
            footprintCache: geometryCache,
          });
          const packElapsed = Date.now() - tPack;
          thicknessPackWallMs += packElapsed;
          remainingThicknessMs = Math.max(0, remainingThicknessMs - packElapsed);
          sumSimplifyOrig += candidates.footprintStats.simplifyOriginalPointsTotal;
          sumSimplifySimplified +=
            candidates.footprintStats.simplifySimplifiedPointsTotal;
          sumFootprintReuse += candidates.footprintStats.reusedInstanceCount;

          engineDebug.totalCandidateRuns +=
            candidates.debugPatch.totalCandidateRuns ?? 0;
          engineDebug.lastWinningCandidateLabel =
            candidates.debugPatch.lastWinningCandidateLabel;
          engineDebug.lastWinningUtilizationPercent =
            candidates.debugPatch.lastWinningUtilizationPercent;
          engineDebug.lastCandidateSummaries =
            candidates.debugPatch.lastCandidateSummaries;
          engineDebug.rotationsSetting = candidates.debugPatch.rotationsSetting;
          engineDebug.svgnestSpacingInConfigMm =
            candidates.debugPatch.svgnestSpacingInConfigMm;
          engineDebug.svgnestInputPolygonCount =
            candidates.debugPatch.svgnestInputPolygonCount;
          engineDebug.svgnestInputBboxFallbackCount =
            candidates.debugPatch.svgnestInputBboxFallbackCount;
          engineDebug.svgnestBboxFallbackInstanceIds =
            candidates.debugPatch.svgnestBboxFallbackInstanceIds;
          engineDebug.nestingEarlyStopReasonLast =
            candidates.debugPatch.nestingEarlyStopReasonLast;
          engineDebug.nestingBestCandidateScore =
            candidates.debugPatch.nestingBestCandidateScore;
          engineDebug.nestingThicknessActualRuntimeMs = thicknessPackWallMs;
          engineDebug.nestingThicknessRemainingBudgetMs = remainingThicknessMs;
          engineDebug.nestingSimplifyOriginalPointsTotal = sumSimplifyOrig;
          engineDebug.nestingSimplifySimplifiedPointsTotal = sumSimplifySimplified;
          engineDebug.nestingSimplifyRatio =
            sumSimplifyOrig > 0
              ? Math.round((sumSimplifySimplified / sumSimplifyOrig) * 1000) /
                1000
              : 1;
          engineDebug.nestingGeometryCacheHits = geometryCache.hits;
          engineDebug.nestingGeometryCacheMisses = geometryCache.misses;
          engineDebug.nestingReusedFootprintInstances = sumFootprintReuse;
          engineDebug.nestingCandidateAttemptsTotal = engineDebug.totalCandidateRuns;

          if (candidates.placed.length > 0) {
            packPlaced = candidates.placed;
            usedPolygonPath = true;
            anySvgNestSheet = true;
            maxSvgnestPlannedParts = Math.max(
              maxSvgnestPlannedParts,
              normalized.length
            );
          }
        } catch (e) {
          warnings.push(
            `SVGNest error (${e instanceof Error ? e.message : "unknown"}) — shelf packing this sheet.`
          );
        }
        await yieldToUi();
      }

      if (!usedPolygonPath || packPlaced.length === 0) {
        if (usePolygonNesting) {
          const fbReason = !effectiveSvgnestWorkerUrl
            ? `Polygon-aware shelf packing (stock ${sg.widthMm}×${sg.lengthMm} mm) — SVGNest worker unavailable.`
            : normalized.length > 0
              ? `SVGNest placed no parts on stock ${sg.widthMm}×${sg.lengthMm} mm — polygon-aware shelf fallback.`
              : `Polygon-aware shelf packing (stock ${sg.widthMm}×${sg.lengthMm} mm).`;
          warnings.push(fbReason);
          engineDebug.shelfFallbackCount += 1;
          engineDebug.shelfFallbackReasons.push(fbReason);
          if (process.env.NODE_ENV === "development") {
            console.warn("[nesting] Shelf fallback:", fbReason);
          }
        }

        const angles = rotationAnglesDeg(
          rules.allowRotation,
          rules.rotationMode
        );
        const boundedAngles =
          angles.length > POLYGON_SHELF_MAX_ANGLE_COUNT
            ? [0, 90, 180, 270]
            : angles;
        const useFastAabbShelf = normalized.length > POLYGON_SHELF_MAX_PARTS;
        if (useFastAabbShelf) {
          const msg = `Large fallback batch (${normalized.length} parts) — using fast shelf approximation to keep UI responsive.`;
          warnings.push(msg);
          engineDebug.shelfFallbackCount += 1;
          engineDebug.shelfFallbackReasons.push(msg);
          packPlaced = packAabbShelfSingleSheetBestWithOrientation({
            normalizedParts: normalized,
            innerBinWidth: innerW,
            innerBinLength: innerL,
            spacingMm: spacing,
            angles: boundedAngles,
          }).placed;
          await yieldToUi();
        } else {
          const adapted = adaptNormalizedShapesForPolygonPlacement(
            normalized,
            spacing,
            (msg) => {
              if (process.env.NODE_ENV === "development") {
                console.warn(msg);
              }
            },
            {
              simplifyToleranceMm: nestingModeParams.simplifyToleranceMm,
              footprintCache: geometryCache,
            }
          );
          engineDebug.nestingSimplifyOriginalPointsTotal =
            (engineDebug.nestingSimplifyOriginalPointsTotal ?? 0) +
            adapted.footprintStats.simplifyOriginalPointsTotal;
          engineDebug.nestingSimplifySimplifiedPointsTotal =
            (engineDebug.nestingSimplifySimplifiedPointsTotal ?? 0) +
            adapted.footprintStats.simplifySimplifiedPointsTotal;
          engineDebug.nestingReusedFootprintInstances =
            (engineDebug.nestingReusedFootprintInstances ?? 0) +
            adapted.footprintStats.reusedInstanceCount;
          engineDebug.nestingGeometryCacheHits = geometryCache.hits;
          engineDebug.nestingGeometryCacheMisses = geometryCache.misses;
          engineDebug.nestingSimplifyRatio =
            (engineDebug.nestingSimplifyOriginalPointsTotal ?? 0) > 0
              ? Math.round(
                  ((engineDebug.nestingSimplifySimplifiedPointsTotal ?? 0) /
                    (engineDebug.nestingSimplifyOriginalPointsTotal ?? 1)) *
                    1000
                ) / 1000
              : 1;
          shelfAdaptMaxPolygon = Math.max(
            shelfAdaptMaxPolygon,
            adapted.polygonPartsCount
          );
          shelfAdaptMaxBbox = Math.max(
            shelfAdaptMaxBbox,
            adapted.bboxFallbackPartsCount
          );
          for (const id of adapted.fallbackPartIds) {
            shelfPolygonFallbackIds.add(id);
          }
          if (adapted.bboxFallbackPartsCount * 2 > normalized.length) {
            warnings.push(
              `More than half of parts (${adapted.bboxFallbackPartsCount}/${normalized.length}) used rectangular footprint fallback for nesting — check outer contours and spacing.`
            );
          }

          const shelfPack = packPolygonAwareShelfSingleSheetBestWithOrientation({
            parts: adapted.parts,
            innerBinWidth: innerW,
            innerBinLength: innerL,
            angles: boundedAngles,
          });
          packPlaced = shelfPack.placed;
          await yieldToUi();
        }
      }

      if (packPlaced.length === 0) {
        warnings.push(
          `Nesting placed no parts on stock ${sg.widthMm}×${sg.lengthMm} mm — trying next stock group if any.`
        );
        unplaced = [...failedNorm, ...okInstances];
        break;
      }

      const sheet: StockSheetEntry = hasRealSheet
        ? pool.shift()!
        : {
            ...sg.entries[0]!,
            id: nanoid(),
            updatedAt: new Date().toISOString(),
          };
      if (!hasRealSheet) {
        implicitForThisGroup += 1;
        implicitSheetsThisThickness += 1;
      }

      generatedSheets.push(
        generatedSheetFromBin(
          sheet,
          thicknessMm,
          innerW,
          innerL,
          packPlaced,
          shapeById
        )
      );
      const placedThisRound = new Set(packPlaced.map((p) => p.id));
      unplaced = [
        ...failedNorm,
        ...okInstances.filter((u) => !placedThisRound.has(u.partInstanceId)),
      ];
    }

    if (implicitForThisGroup > 0) {
      warnings.push(
        `Nesting added ${implicitForThisGroup} extra sheet(s) at ${sg.widthMm}×${sg.lengthMm} mm (same size as configured stock) because parts remained and there were no extra stock rows. Add matching rows in Stock if each physical plate should be listed separately.`
      );
    }
  }

  const sheetAreaSum = generatedSheets.reduce(
    (s, g) => s + g.innerWidthMm * g.innerLengthMm,
    0
  );
  const usedSum = generatedSheets.reduce((s, g) => s + g.usedAreaMm2, 0);
  const wasteSum = generatedSheets.reduce((s, g) => s + g.wasteAreaMm2, 0);
  const util =
    sheetAreaSum > 0 ? (usedSum / sheetAreaSum) * 100 : 0;

  let unplacedReason =
    "Not placed: verify stock thickness (mm) matches part thickness, dimensions are in mm, and you have enough enabled sheets; then generate again.";
  if (unplaced.length > 0) {
    if (generatedSheets.length === 0) {
      unplacedReason =
        "No part was placed on any sheet — usually stock thickness does not match part thickness (check mm), inner area after edge margin is too small, or part DXF units are wrong. Re-check Stock rows vs Parts.";
    } else {
      unplacedReason =
        "Not all parts fit on the configured sheets (shelf packing). Add more sheet lines, increase sheet size, reduce spacing/edge margin in cutting rules, or confirm geometry is in mm.";
    }
  }

  const unplacedParts =
    unplaced.length > 0 ? aggregateUnplaced(unplaced, unplacedReason) : [];

  if (usePolygonNesting) {
    engineDebug.primaryAlgorithm =
      anySvgNestSheet && generatedSheets.length > 0
        ? "svgnest-polygon"
        : "shelf-fallback";
    engineDebug.fullPolygonNesting =
      engineDebug.shelfFallbackCount === 0 && anySvgNestSheet;
  } else {
    engineDebug.primaryAlgorithm = "shelf-fallback";
    engineDebug.fullPolygonNesting = false;
  }

  const placementModeUsed =
    usePolygonNesting &&
    anySvgNestSheet &&
    engineDebug.shelfFallbackCount === 0
      ? "svgnest-polygon"
      : "polygon-aware";

  Object.assign(
    engineDebug,
    buildPolygonPlacementDebugFields({
      placementModeUsed,
      polygonPartsCount: Math.max(
        shelfAdaptMaxPolygon,
        maxSvgnestPlannedParts
      ),
      bboxFallbackPartsCount: shelfAdaptMaxBbox,
      fallbackPartIds: [...shelfPolygonFallbackIds],
      spacingAppliedMm: spacing,
      edgeMarginAppliedMm: margin,
      rotationModeUsed: engineDebug.rotationModeApplied,
    })
  );

  return {
    thicknessMm,
    stockSheetsUsed: generatedSheets.length,
    generatedSheets,
    unplacedParts,
    utilizationPercent: util,
    wasteAreaMm2: wasteSum,
    usedAreaMm2: usedSum,
    warnings,
    errors,
    engineDebug,
  };
}

export async function runAutoNesting(
  options: RunAutoNestingOptions
): Promise<NestingRun> {
  const {
    batchId,
    unitSystem,
    nestDurationMs: nestDurationMsOverride,
    nestingRunMode = "quick",
    usePolygonNesting = true,
  } = options;
  const batch = getBatchById(batchId);
  if (!batch) {
    return {
      id: nanoid(),
      batchId,
      createdAt: new Date().toISOString(),
      totalSheets: 0,
      totalUtilizationPercent: 0,
      totalWasteAreaMm2: 0,
      usedAreaMm2: 0,
      placedPartCount: 0,
      unplacedPartCount: 0,
      thicknessResults: [],
      warnings: [],
      errors: [`Batch ${batchId} not found.`],
    };
  }

  const prep = prepareNestingInputs(batch, unitSystem);
  const thicknessResults: NestingThicknessResult[] = [];

  if (prep.instancesByThickness.size === 0) {
    const runEmpty: NestingRun = {
      id: nanoid(),
      batchId,
      createdAt: new Date().toISOString(),
      totalSheets: 0,
      totalUtilizationPercent: 0,
      totalWasteAreaMm2: 0,
      usedAreaMm2: 0,
      placedPartCount: 0,
      unplacedPartCount: 0,
      thicknessResults: [],
      warnings: [
        ...prep.warnings,
        "No nestable parts (check DXF match, geometry status, quantity, and thickness).",
      ],
      errors: [],
    };
    return runEmpty;
  }

  for (const [, group] of prep.instancesByThickness) {
    if (group.length === 0) continue;
    const th = group[0]!.thicknessMm;
    const tr = await nestThicknessGroup(
      batch,
      th,
      group,
      unitSystem,
      nestingRunMode,
      nestDurationMsOverride,
      usePolygonNesting
    );
    thicknessResults.push(tr);
  }

  const totalSheets = thicknessResults.reduce(
    (s, t) => s + t.generatedSheets.length,
    0
  );
  const totalSheetArea = thicknessResults.reduce(
    (s, t) =>
      s +
      t.generatedSheets.reduce(
        (u, g) => u + g.innerWidthMm * g.innerLengthMm,
        0
      ),
    0
  );
  const usedArea = thicknessResults.reduce((s, t) => s + t.usedAreaMm2, 0);
  const wasteArea = thicknessResults.reduce((s, t) => s + t.wasteAreaMm2, 0);
  const totalUtil =
    totalSheetArea > 0 ? (usedArea / totalSheetArea) * 100 : 0;
  const placedPartCount = thicknessResults.reduce(
    (s, t) =>
      s + t.generatedSheets.reduce((u, g) => u + g.placements.length, 0),
    0
  );
  const unplacedPartCount = thicknessResults.reduce(
    (s, t) =>
      s + t.unplacedParts.reduce((u, p) => u + p.quantityUnplaced, 0),
    0
  );

  const run: NestingRun = {
    id: nanoid(),
    batchId,
    createdAt: new Date().toISOString(),
    totalSheets,
    totalUtilizationPercent: totalUtil,
    totalWasteAreaMm2: wasteArea,
    usedAreaMm2: usedArea,
    placedPartCount,
    unplacedPartCount,
    thicknessResults,
    warnings: [
      ...prep.warnings,
      ...thicknessResults.flatMap((t) => t.warnings),
    ],
    errors: thicknessResults.flatMap((t) => t.errors),
  };

  return run;
}
