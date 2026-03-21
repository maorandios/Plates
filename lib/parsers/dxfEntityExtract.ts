/**
 * Extract DxfEntity[] from raw DXF text — shared by dxfParser and geometry reprocess.
 * Kept separate from dxfParser to avoid circular imports (geometry ↔ dxfParser).
 */

import DxfParser from "dxf-parser";
import type { DxfEntity } from "@/types";

/** Map dxf-parser entities to our DxfEntity shape (must match dxfParser). */
export function mapRawEntitiesToDxfEntities(
  rawEntities: Array<Record<string, unknown>>
): DxfEntity[] {
  return rawEntities.map((e) => {
    const layer = typeof e.layer === "string" ? e.layer : undefined;
    return {
      type: e.type as string,
      layer,
      ...(e as unknown as Record<string, unknown>),
    };
  });
}

/**
 * Parse DXF file content into the same entity shape used by Phase 2A geometry.
 */
export function extractDxfEntitiesFromText(content: string): DxfEntity[] {
  const parser = new DxfParser();
  let parsedDxf: ReturnType<DxfParser["parseSync"]> | null = null;
  try {
    parsedDxf = parser.parseSync(content);
  } catch {
    return [];
  }
  const raw = (parsedDxf?.entities ?? []) as unknown as Array<
    Record<string, unknown>
  >;
  return mapRawEntitiesToDxfEntities(raw);
}
