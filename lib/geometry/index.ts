/**
 * Phase 2A+ — Geometry processing & pre-CAM preparation.
 *
 * Pipeline: normalize entities → cleanup (mm, dedupe) → reconstruct closed loops →
 * classify outer / holes (containment) → validate → manufacturing groups.
 */

import type {
  ProcessedGeometry,
  GeometryCleanupStatus,
  CleanedGeometryResult,
  GeometryPreparation,
} from "@/types";
import type { DxfEntity, DxfPartGeometry } from "@/types";
import { normalizeEntitiesFromDxf } from "./normalizeEntities";
import { cleanupContours } from "./cleanup";
import { reconstructClosedContours } from "./reconstructContours";
import { classifyOuterAndInnerContours } from "./classifyContours";
import {
  buildManufacturingGeometry,
  emptyManufacturingGeometry,
} from "./manufacturingGeometry";
import type { Point } from "./extract";
import {
  polygonPerimeter,
  polygonBoundingBox,
  netArea,
  type BoundingBox,
} from "./calc";
import { validateGeometry, type GeometryStatus } from "./validate";
import { getFileById, getFileData } from "@/lib/store";
import { extractDxfEntitiesFromText } from "@/lib/parsers/dxfEntityExtract";
import {
  extractMaterialGradeFromDxfText,
  extractMaterialGradeFromEntities,
} from "@/lib/parsers/dxfMaterialGrade";

export type { Point, Contour } from "./extract";
export {
  getMarkingText,
  getMarkingPositionMm,
  getMarkingFontSizePx,
  type MarkingPreviewRuleFlags,
  type MarkingPartFields,
  type MarkingPositionMm,
} from "./marking";
export type { BoundingBox } from "./calc";
export type { GeometryStatus } from "./validate";

function tupleRing(loop: Point[]): [number, number][] {
  return loop.map(([x, y]) => [x, y] as [number, number]);
}

function tupleRings(loops: Point[][]): [number, number][][] {
  return loops.map((c) => tupleRing(c));
}

function deriveCleanupStatus(
  validationStatus: GeometryStatus,
  pipelineIssue: boolean
): GeometryCleanupStatus {
  if (validationStatus === "error") return "error";
  if (validationStatus === "warning" || pipelineIssue) return "warning";
  return "ready";
}

function emptyProcessedShell(
  status: GeometryStatus,
  statusMessage: string | undefined,
  preparation: GeometryPreparation
): ProcessedGeometry {
  return {
    outer: [],
    holes: [],
    area: 0,
    perimeter: 0,
    boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
    isValid: false,
    status,
    statusMessage,
    preparation,
  };
}

export interface ProcessPartGeometryContext {
  /** Persisted {@link DxfPartGeometry.id} when reprocessing */
  sourceGeometryId?: string;
}

/**
 * Full geometry + preparation pipeline for DXF entities.
 */
export function processPartGeometry(
  entities: DxfEntity[],
  context: ProcessPartGeometryContext = {}
): ProcessedGeometry | null {
  if (!entities || entities.length === 0) return null;

  const sourceGeometryId = context.sourceGeometryId ?? "";

  const { contours: raw, warnings: extractWarnings } =
    normalizeEntitiesFromDxf(entities);

  const cleanup = cleanupContours(raw, extractWarnings);
  const recon = reconstructClosedContours(cleanup.normalized);
  const discardedAll = [...cleanup.discarded, ...recon.discardedOpen];

  const allWarnings = [
    ...cleanup.warnings,
    ...recon.warnings,
  ];

  const pipelineIssue =
    discardedAll.length > 0 ||
    recon.warnings.length > 0 ||
    cleanup.unitFactorApplied === 25.4 ||
    extractWarnings.length > 0;

  if (recon.closed.length === 0) {
    const errors: string[] = [];
    if (cleanup.normalized.length === 0 && raw.length === 0) {
      errors.push("No usable geometry found in DXF file.");
    } else {
      errors.push(
        "No closed contours found — geometry may be incomplete or gaps exceed snap tolerance."
      );
    }

    const removedFragments = tupleRings(cleanup.removedFragmentRings);
    const invalidFragments = tupleRings(recon.openChains);
    const classificationDiscarded: [number, number][][] = [];
    const reconstructedClosedLoops: [number, number][][] = [];

    const cleaned: CleanedGeometryResult = {
      outerContour: [],
      innerContours: [],
      removedFragments,
      invalidFragments,
      classificationDiscarded,
      reconstructedClosedLoops,
      discardedEntities: discardedAll,
      warnings: allWarnings,
      errors,
      cleanupStatus: "error",
      stats: {
        rawContourCount: raw.length,
        normalizedContourCount: cleanup.normalized.length,
        closedLoopCount: 0,
        innerClassifiedCount: 0,
        removedFragmentCount: removedFragments.length,
        invalidFragmentCount: invalidFragments.length,
        classificationDiscardedCount: 0,
      },
    };

    const preparation: GeometryPreparation = {
      cleaned,
      manufacturing: emptyManufacturingGeometry(sourceGeometryId),
    };

    return emptyProcessedShell(
      "error",
      errors[0],
      preparation
    );
  }

  const { outer, holes, discardedOutsideOuter } =
    classifyOuterAndInnerContours(recon.closed);

  const area = outer.length > 0 ? netArea(outer, holes) : 0;
  const perimeter = outer.length > 0 ? polygonPerimeter(outer) : 0;
  const boundingBox: BoundingBox =
    outer.length > 0
      ? polygonBoundingBox(outer)
      : { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };

  const validation = validateGeometry(outer, holes);
  const cleanupStatus = deriveCleanupStatus(validation.status, pipelineIssue);

  const errors: string[] = [];
  if (validation.status === "error" && validation.message) {
    errors.push(validation.message);
  }

  const removedFragments = tupleRings(cleanup.removedFragmentRings);
  const invalidFragments = tupleRings(recon.openChains);
  const classificationDiscarded = tupleRings(discardedOutsideOuter);
  const reconstructedClosedLoops = tupleRings(recon.closed);

  const cleaned: CleanedGeometryResult = {
    outerContour: tupleRing(outer),
    innerContours: holes.map((h) => tupleRing(h)),
    removedFragments,
    invalidFragments,
    classificationDiscarded,
    reconstructedClosedLoops,
    discardedEntities: discardedAll,
    warnings: allWarnings,
    errors,
    cleanupStatus,
    stats: {
      rawContourCount: raw.length,
      normalizedContourCount: cleanup.normalized.length,
      closedLoopCount: recon.closed.length,
      innerClassifiedCount: holes.length,
      removedFragmentCount: removedFragments.length,
      invalidFragmentCount: invalidFragments.length,
      classificationDiscardedCount: classificationDiscarded.length,
    },
  };

  const manufacturing = buildManufacturingGeometry({
    sourceGeometryId,
    outer,
    holes,
  });

  const preparation: GeometryPreparation = { cleaned, manufacturing };

  return {
    outer: tupleRing(outer),
    holes: holes.map((h) => tupleRing(h)),
    area,
    perimeter,
    boundingBox,
    isValid: validation.isValid,
    status: validation.status,
    statusMessage: validation.message,
    preparation,
  };
}

// ─── Batch re-processing helper ───────────────────────────────────────────────

function resolveDxfFileText(stored: DxfPartGeometry): string | null {
  const file = getFileById(stored.fileId);
  const text = file?.dataKey ? getFileData(file.dataKey) : null;
  return text ?? null;
}

function resolveEntitiesForReprocess(stored: DxfPartGeometry): DxfEntity[] {
  if (stored.entities?.length) {
    return stored.entities;
  }
  const text = resolveDxfFileText(stored);
  if (!text) return [];
  return extractDxfEntitiesFromText(text);
}

function resolveMaterialGrade(
  stored: DxfPartGeometry,
  entities: DxfEntity[]
): string | undefined {
  const text = resolveDxfFileText(stored);
  if (text) {
    const g = extractMaterialGradeFromDxfText(text);
    if (g) return g;
  }
  if (entities.length) {
    const g = extractMaterialGradeFromEntities(entities as unknown[]);
    if (g) return g;
  }
  return stored.materialGrade;
}

/**
 * Re-run the geometry pipeline on a stored DxfPartGeometry.
 */
export function reprocessDxfGeometry(
  stored: DxfPartGeometry
): DxfPartGeometry {
  const entities = resolveEntitiesForReprocess(stored);
  const materialGrade = resolveMaterialGrade(stored, entities);

  if (!entities.length) {
    return { ...stored, processedGeometry: null, materialGrade };
  }
  try {
    const processedGeometry = processPartGeometry(entities, {
      sourceGeometryId: stored.id,
    });
    return { ...stored, processedGeometry, materialGrade };
  } catch {
    return { ...stored, materialGrade };
  }
}
