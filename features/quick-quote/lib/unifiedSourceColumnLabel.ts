import { t } from "@/lib/i18n";
import type { BendTemplateId } from "../bend-plate/types";
import { UNIFIED_SOURCE_REF } from "./mergeAllQuoteMethods";
import type { QuotePartRow } from "../types/quickQuote";

const PP = "quote.partsPhase" as const;

/** Internal unified BOM tokens from {@link UNIFIED_SOURCE_REF} and merge logic. */
function mapSourceToken(
  token: string,
  bendTemplateId: BendTemplateId | undefined
): string {
  const key = token.trim();
  switch (key) {
    case UNIFIED_SOURCE_REF.excelImport:
      return t(`${PP}.sourceColumn.excelTable`);
    case UNIFIED_SOURCE_REF.dxf:
      return t(`${PP}.sourceColumn.dxfFile`);
    case UNIFIED_SOURCE_REF.manualAdd:
      return t(`${PP}.sourceColumn.manual`);
    case UNIFIED_SOURCE_REF.bendPlate:
      if (bendTemplateId) {
        return t(`${PP}.sourceColumn.shape.${bendTemplateId}`);
      }
      return t(`${PP}.sourceColumn.shapeGeneric`);
    default:
      return key || "—";
  }
}

/**
 * Hebrew (etc.) label for the merged-quote "מקור" column from stored `sourceRef` +
 * optional bend template id for `SHAPE` rows.
 */
export function formatUnifiedSourceLabel(
  sourceRef: string | undefined,
  bendTemplateId?: BendTemplateId | null
): string {
  const raw = (sourceRef ?? "").trim();
  if (!raw) return "—";
  const tokens = raw.split(/\s*·\s*/u).map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) return "—";
  return tokens.map((tok) => mapSourceToken(tok, bendTemplateId ?? undefined)).join(" · ");
}

export function formatUnifiedSourceForRow(row: QuotePartRow): string {
  return formatUnifiedSourceLabel(row.sourceRef, row.bendTemplateId);
}
