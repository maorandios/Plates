import type { PurchasedSheetSize } from "@/types/settings";
import { thicknessGroupKey } from "@/lib/nesting/stockConfiguration";

/** Catalog rows that apply to a thickness group in Stock configuration. */
export function filterCatalogForThickness(
  catalog: PurchasedSheetSize[],
  thicknessMm: number | null
): PurchasedSheetSize[] {
  if (thicknessMm == null || !Number.isFinite(thicknessMm)) return [];
  const key = thicknessGroupKey(thicknessMm);
  return catalog.filter(
    (c) =>
      Number.isFinite(c.thicknessMm) &&
      thicknessGroupKey(c.thicknessMm) === key
  );
}
