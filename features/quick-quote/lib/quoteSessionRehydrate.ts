import type { ManualQuotePartRow, QuotePartRow } from "../types/quickQuote";
import { splitMaterialGradeAndFinish } from "./plateFields";
import { nanoid } from "@/lib/utils/nanoid";
import { mergeAllQuoteMethodParts } from "./mergeAllQuoteMethods";
import type { MaterialType } from "@/types/materials";
import type { DxfPartGeometry } from "@/types";
import type { BendPlateQuoteItem } from "../bend-plate/types";

/**
 * When a snapshot has no per-method rows (older saves) but has mergedParts,
 * build manual rows so phase 3 can edit something. Fine for add/remove; DXF/Excel
 * source fidelity may be lost until the user re-imports.
 */
export function quotePartsToFallbackManualRows(
  parts: QuotePartRow[]
): ManualQuotePartRow[] {
  return parts.map((p) => {
    const { grade, finish } = splitMaterialGradeAndFinish(p.material);
    return {
      id: nanoid(),
      partNumber: p.partName,
      thicknessMm: p.thicknessMm,
      widthMm: p.widthMm,
      lengthMm: p.lengthMm,
      quantity: p.qty,
      material: grade,
      finish: finish === "—" ? "ללא" : finish,
      corrugated: p.corrugated,
      sourceMethod: "manualAdd",
    };
  });
}

/**
 * @returns true if the four method sources re-merge to an empty BOM while mergedParts
 * still has data (legacy snapshot or corruption).
 */
export function needsMergedPartsFallback(
  materialType: MaterialType,
  manual: ManualQuotePartRow[],
  excel: ManualQuotePartRow[],
  dxf: DxfPartGeometry[],
  bend: BendPlateQuoteItem[],
  mergedPartsFromSnapshot: QuotePartRow[]
): boolean {
  if (mergedPartsFromSnapshot.length === 0) return false;
  const merged = mergeAllQuoteMethodParts(
    materialType,
    manual,
    excel,
    dxf,
    bend
  );
  return merged.length === 0;
}
