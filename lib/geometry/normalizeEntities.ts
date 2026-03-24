/**
 * Stage A — Entity normalization: DXF entities → polylines in drawing units.
 * LINE / LWPOLYLINE / POLYLINE / ARC / CIRCLE / bulge segments share one contour representation.
 * Millimetre conversion happens in the cleanup stage (unit heuristics).
 */

import type { DxfEntity } from "@/types";
import { extractContours, type ExtractResult } from "./extract";

export type { ExtractResult };

/**
 * Normalize supported DXF entities into raw open/closed polylines (vertex lists).
 * ARCs and circles are tessellated; bulges expanded to arc points.
 */
export function normalizeEntitiesFromDxf(entities: DxfEntity[]): ExtractResult {
  return extractContours(entities);
}
