/**
 * Phase 2A — Geometry Processing Pipeline.
 *
 * Orchestrates the full pipeline:
 *   DXF entities → extract → normalize → classify → calculate → validate
 *
 * Entry point: processPartGeometry(entities)
 */

import type { DxfEntity, DxfPartGeometry } from "@/types";
import { extractContours, type Point } from "./extract";
import { normalizeContours } from "./normalize";
import { isContourClosed } from "./validate";
import {
  classifyContours,
  polygonPerimeter,
  polygonBoundingBox,
  netArea,
  type BoundingBox,
} from "./calc";
import { validateGeometry, type GeometryStatus } from "./validate";
import { POINT_TOLERANCE } from "./normalize";

// ─── Public result type ───────────────────────────────────────────────────────

export interface ProcessedGeometry {
  /** Outer boundary vertices in mm. */
  outer: Point[];
  /** Inner holes (cut-outs) in mm. */
  holes: Point[][];
  /** Net area (outer − holes) in mm². */
  area: number;
  /** Outer boundary perimeter (cut length) in mm. */
  perimeter: number;
  /** Axis-aligned bounding box in mm. */
  boundingBox: BoundingBox;
  /** True when the geometry is usable for nesting. */
  isValid: boolean;
  /** Summarised quality status. */
  status: GeometryStatus;
  /** Human-readable status detail (populated for warning / error). */
  statusMessage?: string;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Convert a list of DXF entities into a clean ProcessedGeometry result.
 *
 * Returns null only if there were zero entities — all other failures
 * are captured as status:"error" geometries so callers always get a result.
 */
export function processPartGeometry(
  entities: DxfEntity[]
): ProcessedGeometry | null {
  if (!entities || entities.length === 0) return null;

  // ── 1. Extract raw contours ──────────────────────────────────────────────
  const { contours: raw } = extractContours(entities);

  // ── 2. Normalize (units, gaps, deduplication, clipper clean) ────────────
  const normalized = normalizeContours(raw);

  // ── 3. Keep only closed contours for classification ──────────────────────
  const closed = normalized.filter((c) =>
    isContourClosed(c, POINT_TOLERANCE * 10)
  );

  // ── 4. Handle no-contour case ────────────────────────────────────────────
  if (closed.length === 0) {
    // Check if we at least have open chains (partial geometry)
    if (normalized.length > 0) {
      return {
        outer: [],
        holes: [],
        area: 0,
        perimeter: 0,
        boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
        isValid: false,
        status: "error",
        statusMessage: "No closed contours found — geometry may be incomplete",
      };
    }
    return {
      outer: [],
      holes: [],
      area: 0,
      perimeter: 0,
      boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
      isValid: false,
      status: "error",
      statusMessage: "No usable geometry found in DXF file",
    };
  }

  // ── 5. Classify outer boundary vs holes ──────────────────────────────────
  const { outer, holes } = classifyContours(closed);

  // ── 6. Calculate metrics ─────────────────────────────────────────────────
  const area = outer.length > 0 ? netArea(outer, holes) : 0;
  const perimeter = outer.length > 0 ? polygonPerimeter(outer) : 0;
  const boundingBox = outer.length > 0 ? polygonBoundingBox(outer) : {
    minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0,
  };

  // ── 7. Validate ───────────────────────────────────────────────────────────
  const validation = validateGeometry(outer, holes);

  return {
    outer,
    holes,
    area,
    perimeter,
    boundingBox,
    isValid: validation.isValid,
    status: validation.status,
    statusMessage: validation.message,
  };
}

// ─── Re-exports for convenience ───────────────────────────────────────────────

export type { Point, Contour } from "./extract";
export type { BoundingBox } from "./calc";
export type { GeometryStatus } from "./validate";

// ─── Batch re-processing helper ───────────────────────────────────────────────

import { getFileById, getFileData } from "@/lib/store";
import { extractDxfEntitiesFromText } from "@/lib/parsers/dxfEntityExtract";
import {
  extractMaterialGradeFromDxfText,
  extractMaterialGradeFromEntities,
} from "@/lib/parsers/dxfMaterialGrade";

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
 * Re-run the geometry pipeline on a stored DxfPartGeometry and return
 * a new object with an updated processedGeometry field.
 *
 * `entities` may be empty on disk (we strip them to save localStorage space);
 * in that case entities are re-parsed from the uploaded DXF file content.
 *
 * Call this at "Rebuild Table" time so that any pipeline improvements
 * take effect without requiring file re-upload.
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
    const processedGeometry = processPartGeometry(entities);
    return { ...stored, processedGeometry, materialGrade };
  } catch {
    return { ...stored, materialGrade };
  }
}
