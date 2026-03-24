/**
 * Auto nesting — thickness-first. **Default: shelf / row packing** on each part’s outer contour
 * AABB (`packShelfSingleSheet`) — reliable in the browser, no workers.
 *
 * **Optional:** `usePolygonNesting: true` tries SVGNest polygon/NFP first (`runNestingCandidates`),
 * then falls back to shelf if the worker fails or places nothing. Enable from the UI via
 * `NEXT_PUBLIC_PLATE_POLYGON_NESTING=1` in `.env.local` (experimental).
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
  NestingThicknessResult,
  SheetPlacement,
  StockSheetEntry,
  UnplacedPart,
} from "@/types";
import type { UnitSystem } from "@/types/settings";
import { nanoid } from "@/lib/utils/nanoid";
import { getBatchById, getStockSheetsByBatch } from "@/lib/store";
import { applyPlacementToRing } from "./applyPlacementTransform";
import { sheetInnerMetrics } from "./calculateNestingMetrics";
import {
  normalizeShapeForNest,
  type NormalizedNestShape,
} from "./convertGeometryToSvgNest";
import type { NestablePartInstance } from "./expandPartInstances";
import {
  packShelfSingleSheetBestWithOrientation,
  rotationAnglesDeg,
  type EnginePlacement,
} from "./shelfNestEngine";
import { prepareNestingInputs } from "./prepareNestingInputs";
import { resolveNestRulesForThickness } from "./resolveBatchThicknessRules";
import { runNestingCandidates } from "./runNestingCandidates";
import { resolveSvgnestWorkerUrlClient } from "./resolveSvgnestWorkerUrl";
import { innerBinDimensionsMm } from "./resolveBinGeometry";
import { thicknessGroupKey } from "./stockConfiguration";

export interface RunAutoNestingOptions {
  batchId: string;
  unitSystem: UnitSystem;
  /**
   * Time budget per sheet when `usePolygonNesting` is true (SVGNest multi-candidate + recovery).
   * Ignored for shelf-only runs (default).
   */
  nestDurationMs?: number;
  /**
   * Try SVGNest polygon nesting before shelf. Default false — shelf packing only (recommended).
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

function buildSheetPlacement(
  pl: EnginePlacement,
  shape: NormalizedNestShape
): SheetPlacement {
  const rot = pl.rotate;
  const tx = pl.translate.x;
  const ty = pl.translate.y;
  const outerContour = applyPlacementToRing(shape.outer, rot, tx, ty);
  const innerContours = shape.holes.map((h) =>
    applyPlacementToRing(h, rot, tx, ty)
  );
  return {
    partInstanceId: shape.partInstanceId,
    partId: shape.partId,
    partName: shape.partName,
    clientId: shape.clientId,
    clientCode: shape.clientCode,
    x: tx,
    y: ty,
    rotation: rot,
    outerContour,
    innerContours,
    markingText: shape.markingText,
    partNetAreaMm2: shape.netAreaMm2,
  };
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
    placements.push(buildSheetPlacement(pl, sh));
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
  nestDurationMs: number,
  usePolygonNesting: boolean
): Promise<NestingThicknessResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const generatedSheets: GeneratedSheet[] = [];
  let unplaced: NestablePartInstance[] = [...instances];

  const rules = resolveNestRulesForThickness(batch, thicknessMm, unitSystem);
  const margin = Math.max(0, rules.edgeMarginMm);
  const spacing = Math.max(0, rules.spacingMm);

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
  };

  const stockGroups = stockGroupsForThickness(batch.id, thicknessMm);

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
          const candidates = await runNestingCandidates({
            normalizedParts: normalized,
            innerBinWidthMm: innerW,
            innerBinLengthMm: innerL,
            spacingMm: spacing,
            edgeMarginMm: margin,
            allowRotation: rules.allowRotation,
            rotationMode: rules.rotationMode,
            totalBudgetMs: nestDurationMs,
            workerUrl: effectiveSvgnestWorkerUrl,
          });
          engineDebug.totalCandidateRuns +=
            candidates.debugPatch.totalCandidateRuns ?? 0;
          engineDebug.lastWinningCandidateLabel =
            candidates.debugPatch.lastWinningCandidateLabel;
          engineDebug.lastWinningUtilizationPercent =
            candidates.debugPatch.lastWinningUtilizationPercent;
          engineDebug.lastCandidateSummaries =
            candidates.debugPatch.lastCandidateSummaries;
          engineDebug.rotationsSetting = candidates.debugPatch.rotationsSetting;

          if (candidates.placed.length > 0) {
            packPlaced = candidates.placed;
            usedPolygonPath = true;
            anySvgNestSheet = true;
          }
        } catch (e) {
          warnings.push(
            `SVGNest error (${e instanceof Error ? e.message : "unknown"}) — shelf packing this sheet.`
          );
        }
      }

      if (!usedPolygonPath || packPlaced.length === 0) {
        if (usePolygonNesting) {
          const fbReason = !effectiveSvgnestWorkerUrl
            ? `Shelf rectangle packing (stock ${sg.widthMm}×${sg.lengthMm} mm) — polygon worker unavailable.`
            : normalized.length > 0
              ? `SVGNest placed no parts on stock ${sg.widthMm}×${sg.lengthMm} mm — shelf fallback.`
              : `Shelf rectangle packing (stock ${sg.widthMm}×${sg.lengthMm} mm).`;
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
        const shelfPack = packShelfSingleSheetBestWithOrientation({
          normalizedParts: normalized,
          innerBinWidth: innerW,
          innerBinLength: innerL,
          spacingMm: spacing,
          angles,
        });
        packPlaced = shelfPack.placed;
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
    nestDurationMs = 28_000,
    usePolygonNesting = false,
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
      nestDurationMs,
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
