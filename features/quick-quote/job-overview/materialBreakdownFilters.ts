import { thicknessGroupKey } from "@/lib/nesting/stockConfiguration";
import type { QuotePartRow, ThicknessStockInput } from "../types/quickQuote";
import { buildMaterialBreakdown, stockLinesForThickness } from "./jobOverview.utils";

export const MATERIAL_FILTER_ALL = "__all__";

const MM_TOL = 0.02;

function safeQty(p: QuotePartRow): number {
  const q = p.qty;
  return typeof q === "number" && Number.isFinite(q) ? Math.max(0, Math.round(q)) : 0;
}

/** Unique material grades from parts (trimmed), sorted. */
export function uniqueMaterialGrades(parts: QuotePartRow[]): string[] {
  const set = new Set<string>();
  for (const p of parts) {
    const m = (p.material || "—").trim() || "—";
    set.add(m);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Distinct thickness groups with display label. */
export function uniqueThicknessOptions(
  parts: QuotePartRow[]
): { key: string; label: string; thicknessMm: number }[] {
  const byKey = new Map<string, { thicknessMm: number }>();
  for (const p of parts) {
    const th = p.thicknessMm;
    if (typeof th !== "number" || !Number.isFinite(th)) continue;
    const key = thicknessGroupKey(th);
    if (!byKey.has(key)) byKey.set(key, { thicknessMm: th });
  }
  return [...byKey.entries()]
    .map(([key, v]) => ({
      key,
      label: `${v.thicknessMm} mm`,
      thicknessMm: v.thicknessMm,
    }))
    .sort((a, b) => a.thicknessMm - b.thicknessMm);
}

export interface SheetSizeOption {
  key: string;
  lengthMm: number;
  widthMm: number;
  label: string;
}

function sheetKey(lengthMm: number, widthMm: number): string {
  return `${Math.round(lengthMm)}x${Math.round(widthMm)}`;
}

/** Deduped stock sheet sizes from quoted thickness stock. */
export function uniqueSheetSizeOptions(
  thicknessStock: ThicknessStockInput[] | null | undefined
): SheetSizeOption[] {
  if (!thicknessStock?.length) return [];
  const seen = new Set<string>();
  const out: SheetSizeOption[] = [];
  for (const row of thicknessStock) {
    for (const s of row.sheets ?? []) {
      if (
        s.sheetLengthMm <= 0 ||
        s.sheetWidthMm <= 0 ||
        !Number.isFinite(s.sheetLengthMm) ||
        !Number.isFinite(s.sheetWidthMm)
      ) {
        continue;
      }
      const k = sheetKey(s.sheetLengthMm, s.sheetWidthMm);
      if (seen.has(k)) continue;
      seen.add(k);
      const l = Math.round(s.sheetLengthMm);
      const w = Math.round(s.sheetWidthMm);
      out.push({
        key: k,
        lengthMm: s.sheetLengthMm,
        widthMm: s.sheetWidthMm,
        label: `${l.toLocaleString()} × ${w.toLocaleString()} mm`,
      });
    }
  }
  return out.sort((a, b) => {
    const areaA = a.lengthMm * a.widthMm;
    const areaB = b.lengthMm * b.widthMm;
    return areaB - areaA;
  });
}

function stockHasSheetSize(
  thicknessMm: number,
  thicknessStock: ThicknessStockInput[] | null | undefined,
  targetL: number,
  targetW: number
): boolean {
  const lines = stockLinesForThickness(thicknessMm, thicknessStock);
  for (const line of lines) {
    const matchDirect =
      Math.abs(line.sheetLengthMm - targetL) < MM_TOL &&
      Math.abs(line.sheetWidthMm - targetW) < MM_TOL;
    const matchSwapped =
      Math.abs(line.sheetLengthMm - targetW) < MM_TOL &&
      Math.abs(line.sheetWidthMm - targetL) < MM_TOL;
    if (matchDirect || matchSwapped) return true;
  }
  return false;
}

export interface MaterialBreakdownViewFilters {
  materialKey: string;
  thicknessKey: string;
  sheetKey: string;
}

export function filterPartsForMaterialBreakdown(
  parts: QuotePartRow[],
  filters: MaterialBreakdownViewFilters,
  thicknessStock: ThicknessStockInput[] | null | undefined
): QuotePartRow[] {
  let out = parts;

  if (filters.materialKey !== MATERIAL_FILTER_ALL) {
    out = out.filter((p) => ((p.material || "—").trim() || "—") === filters.materialKey);
  }

  if (filters.thicknessKey !== MATERIAL_FILTER_ALL) {
    out = out.filter(
      (p) => thicknessGroupKey(p.thicknessMm) === filters.thicknessKey
    );
  }

  if (filters.sheetKey !== MATERIAL_FILTER_ALL) {
    const [ls, ws] = filters.sheetKey.split("x");
    const L = Number(ls);
    const W = Number(ws);
    if (!Number.isFinite(L) || !Number.isFinite(W)) {
      return [];
    }
    out = out.filter((p) =>
      stockHasSheetSize(p.thicknessMm, thicknessStock, L, W)
    );
  }

  return out;
}

export function summarizeMaterialSelection(
  parts: QuotePartRow[],
  thicknessStock: ThicknessStockInput[] | null | undefined
): {
  typeCount: number;
  totalQuantity: number;
  estimatedCost: number;
} {
  const rows = buildMaterialBreakdown(parts, thicknessStock);
  const totalQuantity = parts.reduce((a, p) => a + safeQty(p), 0);
  const estimatedCost = parts.reduce(
    (a, p) => a + (Number.isFinite(p.estimatedLineCost) ? p.estimatedLineCost : 0) * safeQty(p),
    0
  );
  return {
    typeCount: rows.length,
    totalQuantity,
    estimatedCost,
  };
}

export function isMaterialBreakdownFiltered(
  filters: MaterialBreakdownViewFilters
): boolean {
  return (
    filters.materialKey !== MATERIAL_FILTER_ALL ||
    filters.thicknessKey !== MATERIAL_FILTER_ALL ||
    filters.sheetKey !== MATERIAL_FILTER_ALL
  );
}
