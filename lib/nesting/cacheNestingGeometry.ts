/**
 * Reuses identical **nesting footprints** across quantity-expanded instances
 * (same part geometry + spacing + simplification tolerance).
 */

import type { NestPoint } from "./convertGeometryToSvgNest";

export interface CachedNestingFootprintEntry {
  nestingFootprintLocal: NestPoint[];
  placementFootprintSource: "polygon" | "bbox_fallback";
  spacedPointCountBeforeSimplify: number;
  originalPointCountForSimplify: number;
  simplifiedPointCount: number;
}

function cloneRing(ring: NestPoint[]): NestPoint[] {
  return ring.map((p) => ({ x: p.x, y: p.y }));
}

function geometrySignature(outer: NestPoint[]): string {
  return outer
    .map((p) => `${Math.round(p.x * 1000)}:${Math.round(p.y * 1000)}`)
    .join("|");
}

export function nestingFootprintCacheKey(
  outer: NestPoint[],
  halfSpacingMm: number,
  simplifyToleranceMm: number
): string {
  return `${geometrySignature(outer)}@${halfSpacingMm.toFixed(4)}@${simplifyToleranceMm.toFixed(4)}`;
}

export class NestingFootprintGeometryCache {
  private readonly map = new Map<string, CachedNestingFootprintEntry>();

  hits = 0;
  misses = 0;

  peek(key: string): CachedNestingFootprintEntry | undefined {
    return this.map.get(key);
  }

  put(key: string, entry: CachedNestingFootprintEntry): void {
    this.map.set(key, entry);
  }

  onHit(): void {
    this.hits += 1;
  }

  onMiss(): void {
    this.misses += 1;
  }

  /** Deep copy so callers cannot mutate cached geometry. */
  cloneEntry(e: CachedNestingFootprintEntry): CachedNestingFootprintEntry {
    return {
      ...e,
      nestingFootprintLocal: cloneRing(e.nestingFootprintLocal),
    };
  }
}
