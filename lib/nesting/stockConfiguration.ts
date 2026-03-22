import type { Part } from "@/types";
import type { StockSheetEntry, StockSheetType } from "@/types/nesting";

const MM2_TO_M2 = 1 / 1_000_000;

/** Stable grouping key for thickness (matches parts → stock rows). */
export function thicknessGroupKey(thicknessMm: number | null): string {
  if (thicknessMm == null || !Number.isFinite(thicknessMm)) return "__none__";
  return String(thicknessMm);
}

export interface PartThicknessGroup {
  thicknessMm: number | null;
  parts: Part[];
}

/**
 * Distinct thickness values from batch parts (Excel / unified table).
 * Parts without thickness are grouped under `thicknessMm: null`.
 */
export function deriveThicknessGroupsFromParts(
  parts: Part[]
): PartThicknessGroup[] {
  const map = new Map<string, Part[]>();
  for (const p of parts) {
    const has =
      p.thickness != null &&
      typeof p.thickness === "number" &&
      Number.isFinite(p.thickness);
    const key = has ? String(p.thickness) : "__none__";
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  const out: PartThicknessGroup[] = [...map.entries()].map(([k, arr]) => ({
    thicknessMm: k === "__none__" ? null : Number(k),
    parts: arr,
  }));
  out.sort((x, y) => {
    if (x.thicknessMm == null) return 1;
    if (y.thicknessMm == null) return -1;
    return x.thicknessMm - y.thicknessMm;
  });
  return out;
}

export function partCountInGroup(g: PartThicknessGroup): number {
  return g.parts.length;
}

export function totalQuantityInGroup(g: PartThicknessGroup): number {
  return g.parts.reduce((s, p) => s + (p.quantity ?? 1), 0);
}

export function areaM2FromSheetMm(widthMm: number, lengthMm: number): number {
  if (!Number.isFinite(widthMm) || !Number.isFinite(lengthMm)) return 0;
  return widthMm * lengthMm * MM2_TO_M2;
}

export interface StockRowValidation {
  ok: boolean;
  widthError?: string;
  lengthError?: string;
  typeError?: string;
}

export function validateStockSheetEntry(
  e: Pick<StockSheetEntry, "widthMm" | "lengthMm" | "type">
): StockRowValidation {
  const widthError =
    !Number.isFinite(e.widthMm) || e.widthMm <= 0
      ? "Width must be greater than 0"
      : undefined;
  const lengthError =
    !Number.isFinite(e.lengthMm) || e.lengthMm <= 0
      ? "Length must be greater than 0"
      : undefined;
  const typeOk = e.type === "purchase" || e.type === "leftover";
  const typeError = typeOk ? undefined : "Select a type";
  return {
    ok: !widthError && !lengthError && !typeError,
    widthError,
    lengthError,
    typeError,
  };
}

export function countSheetsByType(
  rows: StockSheetEntry[],
  type: StockSheetType
): number {
  return rows.filter((r) => r.type === type).length;
}

/** Default full sheet size (valid) when adding a row — user edits to match inventory. */
export const DEFAULT_STOCK_WIDTH_MM = 3000;
export const DEFAULT_STOCK_LENGTH_MM = 1500;

export function createEmptyStockSheetEntry(
  batchId: string,
  thicknessMm: number | null,
  id: string,
  now: string
): StockSheetEntry {
  return {
    id,
    batchId,
    thicknessMm,
    widthMm: DEFAULT_STOCK_WIDTH_MM,
    lengthMm: DEFAULT_STOCK_LENGTH_MM,
    type: "purchase",
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}
