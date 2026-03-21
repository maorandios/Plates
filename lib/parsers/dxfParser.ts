/**
 * DXF Parser — Phase 2A integration.
 * Parses DXF files and runs the full geometry processing pipeline.
 */

import DxfParser from "dxf-parser";
import type { DxfPartGeometry } from "@/types";
import { nanoid } from "@/lib/utils/nanoid";
import { processPartGeometry } from "@/lib/geometry";
import { mapRawEntitiesToDxfEntities } from "@/lib/parsers/dxfEntityExtract";

export interface DxfParseResult {
  geometry: Omit<DxfPartGeometry, "id">;
  warnings: string[];
}

export function parseDxfFile(
  content: string,
  fileId: string,
  fileName: string,
  clientId: string,
  batchId: string
): DxfParseResult {
  // nanoid is imported but used externally when storing — suppress unused warning
  void nanoid;

  const warnings: string[] = [];

  const guessedPartName = fileName.replace(/\.dxf$/i, "").trim();

  let parsedDxf: ReturnType<DxfParser["parseSync"]> | null = null;

  try {
    const parser = new DxfParser();
    parsedDxf = parser.parseSync(content);
  } catch (err) {
    warnings.push(
      `DXF parse error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!parsedDxf) {
    return {
      geometry: {
        fileId,
        clientId,
        batchId,
        guessedPartName,
        entityCount: 0,
        layers: [],
        entities: [],
        processedGeometry: null,
      },
      warnings,
    };
  }

  const rawEntities = parsedDxf.entities ?? [];
  const layerSet = new Set<string>();

  const entities = mapRawEntitiesToDxfEntities(
    rawEntities as unknown as Array<Record<string, unknown>>
  );
  for (const e of rawEntities) {
    const layer = typeof e.layer === "string" ? e.layer : undefined;
    if (layer) layerSet.add(layer);
  }

  // ── Phase 1: basic bounding box from entity scan ──────────────────────────
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let hasBounds = false;

  for (const e of rawEntities) {
    const pts: Array<{ x: number; y: number }> = [];

    if (e.type === "LINE") {
      const le = e as {
        start?: { x: number; y: number };
        end?: { x: number; y: number };
      };
      if (le.start) pts.push(le.start);
      if (le.end) pts.push(le.end);
    } else if (
      e.type === "LWPOLYLINE" ||
      e.type === "POLYLINE" ||
      e.type === "SPLINE"
    ) {
      const pe = e as { vertices?: Array<{ x: number; y: number }> };
      if (pe.vertices) pts.push(...pe.vertices);
    } else if (e.type === "CIRCLE" || e.type === "ARC") {
      const ce = e as {
        center?: { x: number; y: number };
        radius?: number;
      };
      if (ce.center && ce.radius !== undefined) {
        pts.push({ x: ce.center.x - ce.radius, y: ce.center.y - ce.radius });
        pts.push({ x: ce.center.x + ce.radius, y: ce.center.y + ce.radius });
      }
    }

    for (const pt of pts) {
      if (isFinite(pt.x) && isFinite(pt.y)) {
        hasBounds = true;
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
  }

  // ── Phase 2A: geometry processing ────────────────────────────────────────
  let processedGeometry = null;
  try {
    processedGeometry = processPartGeometry(entities);
  } catch (err) {
    warnings.push(
      `Geometry processing error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return {
    geometry: {
      fileId,
      clientId,
      batchId,
      guessedPartName,
      entityCount: entities.length,
      layers: Array.from(layerSet),
      entities,
      boundingBox: hasBounds ? { minX, minY, maxX, maxY } : undefined,
      processedGeometry,
    },
    warnings,
  };
}
