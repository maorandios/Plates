"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, LayoutGrid, Package, Plus, RotateCcw, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import type { BendPlateQuoteItem, BendTemplateId } from "@/features/quick-quote/bend-plate/types";
import { BendPlateLineItemsTable } from "@/features/quick-quote/bend-plate/BendPlateLineItemsTable";
import { BendTemplatePickerGrid } from "@/features/quick-quote/bend-plate/BendTemplatePickerGrid";
import { MethodPhaseMetricStrip } from "@/features/quick-quote/components/method-phases/MethodPhaseMetricStrip";
import { jobSummaryFromParts } from "@/features/quick-quote/lib/deriveQuoteSelection";
import { mergeAllQuoteMethodParts } from "@/features/quick-quote/lib/mergeAllQuoteMethods";
import type { ManualQuotePartRow } from "@/features/quick-quote/types/quickQuote";
import { t } from "@/lib/i18n";

const VIEWPORT = "flex h-full min-h-0 max-h-full flex-col overflow-hidden";
const BP = "quote.bendPlatePhase";

export interface PlateProjectDrawingPickerPhaseProps {
  materialType: MaterialType;
  manualQuoteRows: ManualQuotePartRow[];
  excelImportQuoteRows: ManualQuotePartRow[];
  dxfMethodGeometries: DxfPartGeometry[];
  bendPlateQuoteItems: BendPlateQuoteItem[];
  onSelectTemplate: (template: BendTemplateId) => void;
  onEditBendPlateItem: (item: BendPlateQuoteItem) => void;
  onUpdateBendPlateItem: (item: BendPlateQuoteItem) => void;
  onRemoveBendPlateItem: (id: string) => void;
  onResetRequest: () => void;
  resetDisabled: boolean;
}

export function PlateProjectDrawingPickerPhase({
  materialType,
  manualQuoteRows,
  excelImportQuoteRows,
  dxfMethodGeometries,
  bendPlateQuoteItems,
  onSelectTemplate,
  onEditBendPlateItem,
  onUpdateBendPlateItem,
  onRemoveBendPlateItem,
  onResetRequest,
  resetDisabled,
}: PlateProjectDrawingPickerPhaseProps) {
  /** Same as Quick Quote bend hub: table vs full-screen template picker. */
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  useEffect(() => {
    if (bendPlateQuoteItems.length === 0) setShowTemplatePicker(false);
  }, [bendPlateQuoteItems.length]);

  const mergedParts = useMemo(
    () =>
      mergeAllQuoteMethodParts(
        materialType,
        manualQuoteRows,
        excelImportQuoteRows,
        dxfMethodGeometries,
        bendPlateQuoteItems
      ),
    [
      materialType,
      manualQuoteRows,
      excelImportQuoteRows,
      dxfMethodGeometries,
      bendPlateQuoteItems,
    ]
  );

  const metrics = useMemo(() => jobSummaryFromParts(mergedParts), [mergedParts]);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-0 overflow-hidden",
        VIEWPORT
      )}
    >
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <aside className="flex h-full min-h-0 w-full max-w-[min(336px,33.6vw)] shrink-0 flex-col border-e border-border bg-card/60">
          <div className="shrink-0 space-y-2 px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-snug">
              {t("plateProject.drawingPhase.title")}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("plateProject.drawingPhase.subtitle")}
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col divide-y divide-border">
            <MethodPhaseMetricStrip
              icon={Package}
              label={t("methodMetrics.quantity")}
              value={formatInteger(metrics.totalQty)}
            />
            <MethodPhaseMetricStrip
              icon={LayoutGrid}
              label={t("methodMetrics.area")}
              value={formatDecimal(metrics.totalPlateAreaM2, 2)}
              valueUnit={t("methodMetrics.unitM2")}
            />
            <MethodPhaseMetricStrip
              icon={Weight}
              label={t("methodMetrics.weight")}
              value={formatDecimal(metrics.totalEstWeightKg, 1)}
              valueUnit={t("methodMetrics.unitKg")}
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="shrink-0 border-b border-border bg-card/45 px-4 py-3.5 sm:px-6 sm:py-4">
            {/* Physical layout: reset = left, copy = right (grid avoids parent RTL flex quirks). */}
            <div
              className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3"
              dir="ltr"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={resetDisabled}
                onClick={onResetRequest}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t("plateProject.drawingPhase.reset")}
              </Button>
              <div className="flex min-w-0 justify-end">
                <p
                  className="max-w-[min(42rem,100%)] text-end text-sm leading-relaxed text-foreground/90 sm:text-[15px]"
                  dir="rtl"
                >
                  {t("plateProject.drawingPhase.stripe")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {bendPlateQuoteItems.length === 0 ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-auto p-4 sm:p-5">
                <div className="flex min-h-[min(20rem,50vh)] min-w-0 flex-1 overflow-x-auto overflow-y-auto">
                  <BendTemplatePickerGrid
                    quoteItems={bendPlateQuoteItems}
                    onSelectTemplate={onSelectTemplate}
                  />
                </div>
              </div>
            ) : showTemplatePicker ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-x-auto overflow-y-auto p-4 sm:p-5">
                <div className="flex w-full shrink-0 justify-end" dir="rtl">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setShowTemplatePicker(false)}
                  >
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                    {t(`${BP}.backToPartsList`)}
                  </Button>
                </div>
                <div className="flex min-h-[min(22rem,55vh)] min-w-0 flex-1 overflow-x-auto overflow-y-auto">
                  <BendTemplatePickerGrid
                    quoteItems={bendPlateQuoteItems}
                    onSelectTemplate={onSelectTemplate}
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto p-4 sm:p-5">
                <div className="shrink-0 space-y-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("plateProject.drawingPhase.platesListTitle")}
                  </h2>
                  <BendPlateLineItemsTable
                    quoteItems={bendPlateQuoteItems}
                    onEdit={onEditBendPlateItem}
                    onUpdateItem={onUpdateBendPlateItem}
                    onRemove={onRemoveBendPlateItem}
                  />
                </div>
                <div className="mt-4 flex justify-start" dir="rtl">
                  <Button
                    type="button"
                    variant="default"
                    size="default"
                    className="gap-2"
                    onClick={() => setShowTemplatePicker(true)}
                  >
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    {t(`${BP}.addNewPart`)}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
