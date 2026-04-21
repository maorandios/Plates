import { thicknessGroupKey } from "@/lib/nesting/stockConfiguration";
import type { MaterialType } from "@/types/materials";
import { MATERIAL_TYPE_LABELS } from "@/types/materials";
import { splitMaterialGradeAndFinish } from "../lib/plateFields";
import type { QuotePartRow } from "../types/quickQuote";

/** Parse user-entered price/kg (empty → 0). */
export function parseMaterialPricePerKg(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Same key as {@link buildMaterialPricingLines} rows — maps a BOM line to its pricing bucket. */
export function materialPricingRowKey(
  part: QuotePartRow,
  materialType: MaterialType
): string {
  const { grade, finish } = splitMaterialGradeAndFinish(part.material);
  const g = grade.trim() || "—";
  const f = finish.trim() || "—";
  const corrugated = part.corrugated === true ? "1" : "0";
  return `${materialType}|${thicknessGroupKey(part.thicknessMm)}|${g.toLowerCase()}|${f.toLowerCase()}|${corrugated}`;
}

export interface MaterialPricingLine {
  /** Stable key for inputs / React (family + thickness + grade + finish + plain|פח מרוג). */
  rowKey: string;
  steelFamily: MaterialType;
  steelFamilyLabel: string;
  thicknessMm: number;
  /** פח מרוג — separate pricing bucket from plain at the same thickness. */
  corrugated: boolean;
  grade: string;
  finish: string;
  /** Total net weight for this combination (all parts × qty). */
  totalWeightKg: number;
}

/**
 * Unique material pricing lines for the job: steel family (from quote settings) × thickness ×
 * grade × finish (parsed from each line’s material string), with summed weight.
 */
export function buildMaterialPricingLines(
  parts: QuotePartRow[],
  materialType: MaterialType
): MaterialPricingLine[] {
  if (parts.length === 0) return [];

  const map = new Map<
    string,
    {
      thicknessMm: number;
      corrugated: boolean;
      grade: string;
      finish: string;
      weightKg: number;
    }
  >();

  for (const p of parts) {
    const rowKey = materialPricingRowKey(p, materialType);
    const { grade, finish } = splitMaterialGradeAndFinish(p.material);
    const g = grade.trim() || "—";
    const f = finish.trim() || "—";
    const corrugated = p.corrugated === true;
    const qty = Math.max(0, Math.round(p.qty));
    const lineKg = Math.max(0, p.weightKg) * qty;

    const prev = map.get(rowKey);
    if (prev) {
      prev.weightKg += lineKg;
    } else {
      map.set(rowKey, {
        thicknessMm: p.thicknessMm,
        corrugated,
        grade: g,
        finish: f,
        weightKg: lineKg,
      });
    }
  }

  const out: MaterialPricingLine[] = [];
  for (const [rowKey, v] of map) {
    out.push({
      rowKey,
      steelFamily: materialType,
      steelFamilyLabel: MATERIAL_TYPE_LABELS[materialType],
      thicknessMm: Math.round(v.thicknessMm * 100) / 100,
      corrugated: v.corrugated,
      grade: v.grade,
      finish: v.finish,
      totalWeightKg: v.weightKg,
    });
  }

  out.sort((a, b) => {
    const d = a.thicknessMm - b.thicknessMm;
    if (d !== 0) return d;
    if (a.corrugated !== b.corrugated) return a.corrugated ? 1 : -1;
    const g = a.grade.localeCompare(b.grade, undefined, { sensitivity: "base" });
    if (g !== 0) return g;
    return a.finish.localeCompare(b.finish, undefined, { sensitivity: "base" });
  });

  return out;
}
