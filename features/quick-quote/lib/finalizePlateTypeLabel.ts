import { t } from "@/lib/i18n";

const FP = "quote.finalizePhase" as const;

/** Hebrew plate / bend template label for finalize / preview tables (`plate_shape`). */
export function finalizePlateTypeLabel(shape: string | undefined): string {
  const s = (shape || "flat").toLowerCase();
  const key = `${FP}.plateShapeLabels.${s}`;
  const label = t(key);
  return label === key ? s : label;
}
