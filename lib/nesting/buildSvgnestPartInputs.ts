/**
 * Builds per-part SVGNest SVG geometry: cleaned + outward-offset outer for spacing,
 * with per-instance bbox fallback. Display geometry stays on `NormalizedNestShape.outer`.
 *
 * @see lib/nesting/SVGNEST_PIPELINE.md
 */

import type {
  NormalizedNestShape,
  PolygonAwareNestShape,
  SvgnestPartInput,
} from "./convertGeometryToSvgNest";
import {
  NestingFootprintGeometryCache,
} from "./cacheNestingGeometry";
import {
  adaptNormalizedShapesForPolygonPlacement,
  type AdaptFootprintOptions,
} from "./runPolygonAwarePlacement";

function toBaseShape(p: PolygonAwareNestShape): NormalizedNestShape {
  return {
    partInstanceId: p.partInstanceId,
    partId: p.partId,
    partName: p.partName,
    clientId: p.clientId,
    clientCode: p.clientCode,
    markingText: p.markingText,
    netAreaMm2: p.netAreaMm2,
    outer: p.outer,
    holes: p.holes,
  };
}

/**
 * Converts normalized instances into SVGNest polygons (offset outers + optional bbox fallback).
 * Spacing is encoded in `nestingOuter`; SVGNest `spacing` config should be **0** to avoid double offset.
 */
export function buildSvgnestPartInputs(
  normalized: NormalizedNestShape[],
  spacingMm: number,
  logIssue?: (message: string) => void,
  adaptOpts?: AdaptFootprintOptions
): {
  parts: SvgnestPartInput[];
  polygonCount: number;
  bboxFallbackCount: number;
  bboxFallbackInstanceIds: string[];
  footprintStats: {
    simplifyOriginalPointsTotal: number;
    simplifySimplifiedPointsTotal: number;
    reusedInstanceCount: number;
  };
} {
  const adapted = adaptNormalizedShapesForPolygonPlacement(
    normalized,
    spacingMm,
    logIssue,
    adaptOpts
  );
  const parts: SvgnestPartInput[] = adapted.parts.map((p) => ({
    shape: toBaseShape(p),
    nestingOuter: p.nestingFootprintLocal,
    geometrySource:
      p.placementFootprintSource === "polygon" ? "polygon" : "bbox_fallback",
  }));
  return {
    parts,
    polygonCount: adapted.polygonPartsCount,
    bboxFallbackCount: adapted.bboxFallbackPartsCount,
    bboxFallbackInstanceIds: [...adapted.fallbackPartIds],
    footprintStats: adapted.footprintStats,
  };
}

export function createFootprintGeometryCache(): NestingFootprintGeometryCache {
  return new NestingFootprintGeometryCache();
}
