import { formatMaterialGradeAndFinish } from "../lib/plateFields";
import type { QuotePartRow } from "../types/quickQuote";
import type { BendPlateQuoteItem } from "./types";

/** Map stored bend-plate lines to quote part rows (flat blank metrics). */
export function bendPlateQuoteItemsToQuoteParts(
  items: BendPlateQuoteItem[]
): QuotePartRow[] {
  return items.map((item) => {
    const qty = Math.max(1, Math.floor(item.global.quantity) || 1);
    const perUnitWeight = item.calc.weightKg / qty;
    return {
      id: item.id,
      partName: `Bend plate (${item.template})`,
      qty,
      material: formatMaterialGradeAndFinish(
        item.global.material,
        item.global.finish
      ),
      thicknessMm: item.global.thicknessMm,
      lengthMm: item.calc.blankLengthMm,
      widthMm: item.calc.blankWidthMm,
      areaM2: item.calc.areaM2,
      weightKg: perUnitWeight,
      cutLengthMm: item.calc.developedLengthMm,
      pierceCount: 0,
      validationStatus: "valid",
      estimatedLineCost: 0,
      bendTemplateId: item.template,
      dxfFileName: "—",
      excelRowRef: "—",
      notes: "",
    };
  });
}
