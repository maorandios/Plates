import type { MaterialType } from "@/types/materials";
import type { PurchasedSheetSize } from "@/types/settings";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { filterCatalogForThickness } from "@/lib/settings/purchasedSheetsCatalog";
import { thicknessGroupKey } from "@/lib/nesting/stockConfiguration";
import { nanoid } from "@/lib/utils/nanoid";
import type { QuoteSheetStockLine } from "../types/quickQuote";

/** Stable key for sheet footprint (order-independent). */
export function sheetFootprintKey(widthMm: number, lengthMm: number): string {
  const a = Math.min(widthMm, lengthMm);
  const b = Math.max(widthMm, lengthMm);
  return `${Math.round(a * 1000) / 1000}x${Math.round(b * 1000) / 1000}`;
}

export function thicknessMatchesStockList(
  thicknessMm: number,
  thicknessesMm: number[]
): boolean {
  const key = thicknessGroupKey(thicknessMm);
  return thicknessesMm.some((t) => thicknessGroupKey(t) === key);
}

export function hasDuplicateSheetSizes(sheets: QuoteSheetStockLine[]): boolean {
  const seen = new Set<string>();
  for (const s of sheets) {
    if (s.sheetLengthMm <= 0 || s.sheetWidthMm <= 0) continue;
    const k = sheetFootprintKey(s.sheetWidthMm, s.sheetLengthMm);
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

/**
 * Seeds quote lines from material settings (stock sheets that include this thickness)
 * plus the global purchased-sheet catalog for this thickness. Dedupes by footprint.
 */
export function seedSheetsForThickness(
  materialType: MaterialType,
  thicknessMm: number,
  purchasedCatalog: PurchasedSheetSize[]
): QuoteSheetStockLine[] {
  const cfg = getMaterialConfig(materialType);
  const lines: QuoteSheetStockLine[] = [];
  const seen = new Set<string>();

  function push(
    widthMm: number,
    lengthMm: number,
    meta: { catalogId?: string; materialSheetId?: string }
  ) {
    if (widthMm <= 0 || lengthMm <= 0) return;
    const k = sheetFootprintKey(widthMm, lengthMm);
    if (seen.has(k)) return;
    seen.add(k);
    lines.push({
      id: nanoid(),
      sheetLengthMm: Math.max(widthMm, lengthMm),
      sheetWidthMm: Math.min(widthMm, lengthMm),
      catalogId: meta.catalogId,
      materialSheetId: meta.materialSheetId,
    });
  }

  for (const stock of cfg.stockSheets) {
    if (!stock.enabled) continue;
    if (!thicknessMatchesStockList(thicknessMm, stock.thicknessesMm)) continue;
    push(stock.widthMm, stock.lengthMm, { materialSheetId: stock.id });
  }

  for (const c of filterCatalogForThickness(purchasedCatalog, thicknessMm)) {
    push(c.widthMm, c.lengthMm, { catalogId: c.id });
  }

  return lines;
}
