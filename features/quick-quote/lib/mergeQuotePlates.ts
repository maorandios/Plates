import type { ManualQuotePartRow, QuoteCreationMethod } from "../types/quickQuote";

/** Short labels for UI / notes when rows from several methods are combined. */
export const QUOTE_METHOD_LABEL: Record<QuoteCreationMethod, string> = {
  dxf: "DXF",
  manualAdd: "Manual",
  excelImport: "Excel list",
  bendPlate: "Bend plate",
};

/**
 * When merging line items from several sources, the same display part number (e.g. PL01)
 * can appear more than once. This rewrites `partNumber` so every line is unique:
 * first occurrence keeps the base name, later duplicates become `PL01 (2)`, `PL01 (3)`, …
 *
 * Preserves the original label in `clientPartLabel` when present; otherwise uses the
 * part number string before suffixes were applied.
 */
export function assignUniqueDisplayPartNumbers(
  rows: ManualQuotePartRow[]
): ManualQuotePartRow[] {
  const countByBase = new Map<string, number>();
  return rows.map((row) => {
    const baseRaw = (row.partNumber || "").trim() || "—";
    const baseKey = baseRaw.toLowerCase();
    const n = (countByBase.get(baseKey) ?? 0) + 1;
    countByBase.set(baseKey, n);

    const partNumber = n === 1 ? baseRaw : `${baseRaw} (${n})`;
    return {
      ...row,
      partNumber,
      clientPartLabel: row.clientPartLabel ?? baseRaw,
    };
  });
}

/**
 * Concatenate several method buckets (each already tagged with `sourceMethod`) and
 * apply {@link assignUniqueDisplayPartNumbers}. Use this when building one unified BOM
 * from multiple quote input methods.
 */
export function mergeManualLikeRowsFromMethods(
  groups: { method: QuoteCreationMethod; rows: ManualQuotePartRow[] }[]
): ManualQuotePartRow[] {
  const flat: ManualQuotePartRow[] = [];
  for (const { method, rows } of groups) {
    for (const r of rows) {
      const base = (r.partNumber || "").trim() || "—";
      flat.push({
        ...r,
        sourceMethod: r.sourceMethod ?? method,
        clientPartLabel: r.clientPartLabel ?? base,
      });
    }
  }
  return assignUniqueDisplayPartNumbers(flat);
}
