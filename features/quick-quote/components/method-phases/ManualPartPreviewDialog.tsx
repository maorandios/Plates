"use client";

import {
  Hash,
  Layers,
  MoveHorizontal,
  MoveVertical,
  Palette,
  Square,
  Tag,
  Weight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/lib/i18n";
import { formatDecimal } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { QuotePartGeometryPreview } from "../QuotePartGeometryPreview";
import {
  PART_PREVIEW_DIALOG_CONTENT_CLASS,
  PreviewStatCell,
  StatValueUnitLeft,
} from "../partPreviewModalShared";
import {
  manualQuoteRowsToQuoteParts,
  manualRowLineAreaM2,
  manualRowLineWeightKg,
} from "../../lib/manualQuoteParts";
import type { ManualQuotePartRow } from "../../types/quickQuote";

interface ManualPartPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ManualQuotePartRow | null;
  lineNumber: number;
  densityKgPerM3: number;
}

/** Preview modal for manually entered geometry — same shell as Excel quote-import preview. */
export function ManualPartPreviewDialog({
  open,
  onOpenChange,
  row,
  lineNumber,
  densityKgPerM3,
}: ManualPartPreviewDialogProps) {
  const previewPart =
    row != null ? manualQuoteRowsToQuoteParts([row], densityKgPerM3)[0] : null;
  const totalAreaM2 = row != null ? manualRowLineAreaM2(row) : 0;
  const totalWeightKg =
    row != null ? manualRowLineWeightKg(row, densityKgPerM3) : 0;
  const partLabel = row?.partNumber.trim() ? row.partNumber.trim() : String(lineNumber);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={cn(PART_PREVIEW_DIALOG_CONTENT_CLASS)}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" dir="rtl">
          <DialogTitle className="sr-only">
            {t("quote.dxfPhase.partPreviewModal.a11yTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("quote.dxfPhase.partPreviewModal.a11yTitle")}
          </DialogDescription>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="flex min-h-[min(45vh,475px)] flex-1 shrink-0 items-center justify-center px-5 py-6"
              dir="ltr"
            >
              <div className="relative flex h-[min(425px,52vh)] w-full min-w-0 max-w-full items-center justify-center overflow-hidden bg-transparent">
                {previewPart ? (
                  <QuotePartGeometryPreview
                    part={previewPart}
                    dxfGeometries={null}
                    rectangleAppearance="dxfPreviewModal"
                    className="min-h-0 w-full max-w-full border-0 bg-transparent shadow-none [&>div]:min-h-0 [&>div]:bg-transparent [&_svg]:max-h-[min(400px,48vh)]"
                  />
                ) : null}
              </div>
            </div>

            <div className="w-full shrink-0 border-t border-white/10">
              {row ? (
                <div dir="ltr" className="w-full overflow-hidden">
                  <div className="grid w-full grid-cols-4 grid-rows-2">
                    {(
                      [
                        {
                          key: "finish",
                          icon: Palette,
                          label: t("quote.dxfPhase.partPreviewModal.finish"),
                          value: t(`quote.finishLabels.${row.finish}`),
                        },
                        {
                          key: "thickness",
                          icon: Layers,
                          label: t("quote.dxfPhase.partPreviewModal.thickness"),
                          value: (
                            <StatValueUnitLeft
                              numericText={formatDecimal(Number(row.thicknessMm) || 0, 1)}
                              unitSuffix={t("quote.dxfPhase.partPreviewModal.mmSuffix")}
                            />
                          ),
                        },
                        {
                          key: "quantity",
                          icon: Hash,
                          label: t("quote.dxfPhase.partPreviewModal.quantity"),
                          value: Math.max(0, Math.floor(row.quantity)),
                        },
                        {
                          key: "plateName",
                          icon: Tag,
                          label: t("quote.dxfPhase.partPreviewModal.plateName"),
                          value: partLabel,
                        },
                        {
                          key: "weight",
                          icon: Weight,
                          label: t("quote.dxfPhase.partPreviewModal.weight"),
                          value:
                            totalWeightKg > 0 ? (
                              <StatValueUnitLeft
                                numericText={formatDecimal(totalWeightKg, 2)}
                                unitSuffix={t("quote.dxfPhase.partPreviewModal.kgSuffix")}
                              />
                            ) : (
                              "-"
                            ),
                        },
                        {
                          key: "area",
                          icon: Square,
                          label: t("quote.dxfPhase.partPreviewModal.area"),
                          value:
                            totalAreaM2 > 0 ? (
                              <StatValueUnitLeft
                                numericText={formatDecimal(totalAreaM2, 4)}
                                unitSuffix={t("quote.dxfPhase.partPreviewModal.m2Suffix")}
                              />
                            ) : (
                              "-"
                            ),
                        },
                        {
                          key: "length",
                          icon: MoveHorizontal,
                          label: t("quote.dxfPhase.partPreviewModal.length"),
                          value: (
                            <StatValueUnitLeft
                              numericText={formatDecimal(row.lengthMm, 1)}
                              unitSuffix={t("quote.dxfPhase.partPreviewModal.mmSuffix")}
                            />
                          ),
                        },
                        {
                          key: "width",
                          icon: MoveVertical,
                          label: t("quote.dxfPhase.partPreviewModal.width"),
                          value: (
                            <StatValueUnitLeft
                              numericText={formatDecimal(row.widthMm, 1)}
                              unitSuffix={t("quote.dxfPhase.partPreviewModal.mmSuffix")}
                            />
                          ),
                        },
                      ] as const
                    ).map((cell, i) => (
                      <PreviewStatCell
                        key={cell.key}
                        icon={cell.icon}
                        label={cell.label}
                        value={cell.value}
                        className={cn(
                          "border-b border-solid border-[#00FF9F]/20",
                          i % 4 === 0 && "border-s",
                          i % 4 !== 3 && "border-e"
                        )}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("quote.dxfPhase.partPreviewModal.noGeometry")}
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
