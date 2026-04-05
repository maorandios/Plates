import type { DxfPartGeometry } from "@/types";
import type { QuotePartRow } from "../types/quickQuote";

/**
 * Resolve DXF geometry for a merged quote line: match on row id or any `lineSourceIds`
 * (merged rows keep contributing geometry ids).
 */
export function findDxfGeometryForQuotePart(
  part: QuotePartRow,
  geometries: DxfPartGeometry[] | undefined
): DxfPartGeometry | null {
  if (!geometries?.length) return null;
  const byId = geometries.find((g) => g.id === part.id);
  if (byId) return byId;
  if (part.lineSourceIds?.length) {
    for (const sid of part.lineSourceIds) {
      const g = geometries.find((x) => x.id === sid);
      if (g) return g;
    }
  }
  return null;
}
