"use client";

import { useMemo } from "react";
import { LayoutGrid, Package, RotateCcw, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import type { BendPlateQuoteItem, BendTemplateId } from "@/features/quick-quote/bend-plate/types";
import { BendTemplatePickerGlyph } from "@/features/quick-quote/bend-plate/BendTemplateShapeGlyph";
import { MethodPhaseMetricStrip } from "@/features/quick-quote/components/method-phases/MethodPhaseMetricStrip";
import { jobSummaryFromParts } from "@/features/quick-quote/lib/deriveQuoteSelection";
import { mergeAllQuoteMethodParts } from "@/features/quick-quote/lib/mergeAllQuoteMethods";
import type { ManualQuotePartRow } from "@/features/quick-quote/types/quickQuote";
import { t } from "@/lib/i18n";

const VIEWPORT = "flex h-full min-h-0 max-h-full flex-col overflow-hidden";
const BP_TEMPLATE = "quote.bendPlatePhase.template";

function templateTitle(id: BendTemplateId): string {
  return t(`${BP_TEMPLATE}.${id}.name`);
}

function templateHasRows(id: BendTemplateId, items: BendPlateQuoteItem[]): boolean {
  return items.some((x) => x.template === id);
}

/**
 * Fixed 4×2 layout (LTR columns so col 1 = visual left, col 4 = visual right).
 * Col 1: מדרגה / מותאם אישית · Col 2: תעלה / מרזב · Col 3: זוית / אומגה · Col 4: ריבוע rowspan 2.
 */
const PLATE_PROJECT_TEMPLATE_GRID: {
  id: BendTemplateId;
  gridClass: string;
}[] = [
  { id: "z", gridClass: "col-start-1 row-start-1" },
  { id: "custom", gridClass: "col-start-1 row-start-2" },
  { id: "u", gridClass: "col-start-2 row-start-1" },
  { id: "gutter", gridClass: "col-start-2 row-start-2" },
  { id: "l", gridClass: "col-start-3 row-start-1" },
  { id: "omega", gridClass: "col-start-3 row-start-2" },
  { id: "plate", gridClass: "col-start-4 row-start-1 row-span-2" },
];

export interface PlateProjectDrawingPickerPhaseProps {
  materialType: MaterialType;
  manualQuoteRows: ManualQuotePartRow[];
  excelImportQuoteRows: ManualQuotePartRow[];
  dxfMethodGeometries: DxfPartGeometry[];
  bendPlateQuoteItems: BendPlateQuoteItem[];
  onSelectTemplate: (template: BendTemplateId) => void;
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
  onResetRequest,
  resetDisabled,
}: PlateProjectDrawingPickerPhaseProps) {
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
        <aside className="flex h-full min-h-0 w-full max-w-[min(336px,33.6vw)] shrink-0 flex-col border-e border-white/[0.08] bg-card/60">
          <div className="shrink-0 space-y-2 px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-snug">
              {t("plateProject.drawingPhase.title")}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("plateProject.drawingPhase.subtitle")}
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col divide-y divide-white/[0.06]">
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
          <div className="shrink-0 border-b border-white/[0.08] bg-card/45 px-4 py-3.5 sm:px-6 sm:py-4">
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
          <div className="flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto p-4 sm:p-5">
            {/* dir=ltr: column 1 is the visual left edge, matching the reference layout */}
            <div
              dir="ltr"
              className={cn(
                "mx-auto grid min-h-[min(100%,28rem)] w-full min-w-[44rem] flex-1 gap-4",
                "grid-cols-4 grid-rows-2 [grid-template-rows:minmax(12rem,1fr)_minmax(12rem,1fr)]"
              )}
            >
              {PLATE_PROJECT_TEMPLATE_GRID.map(({ id, gridClass }) => {
                const title = templateTitle(id);
                const hasData = templateHasRows(id, bendPlateQuoteItems);
                const isTall = id === "plate";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectTemplate(id)}
                    aria-label={title}
                    className={cn(
                      gridClass,
                      "group flex min-h-0 min-w-0 flex-col items-center justify-center rounded-xl border-2 bg-card p-5 text-center transition-all duration-150",
                      isTall ? "h-full min-h-[14rem]" : "min-h-[12rem]",
                      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      hasData &&
                        "border-primary shadow-[0_0_28px_-10px_hsl(var(--primary)/0.55)] ring-2 ring-primary/50 hover:border-primary hover:ring-primary/60",
                      !hasData &&
                        "border-white/[0.08] hover:border-primary/50 hover:bg-card/90"
                    )}
                  >
                    <div
                      className={cn(
                        "mb-4 flex shrink-0 items-center justify-center rounded-xl transition-colors",
                        isTall ? "h-14 w-14" : "h-11 w-11",
                        hasData
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground group-hover:bg-muted/90"
                      )}
                    >
                      <BendTemplatePickerGlyph
                        id={id}
                        className={cn(
                          "shrink-0",
                          isTall ? "h-8 w-[3.25rem]" : "h-6 w-[2.75rem]"
                        )}
                      />
                    </div>
                    <div
                      className={cn(
                        "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5",
                        hasData
                          ? "border-primary/30 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "border-white/[0.12] bg-muted/35"
                      )}
                      dir="rtl"
                    >
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          hasData
                            ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.65)]"
                            : "bg-muted-foreground/50"
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "text-sm font-semibold leading-snug",
                          hasData ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {title}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
