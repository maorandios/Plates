"use client";

import { useMemo } from "react";
import {
  ClipboardList,
  FileCode2,
  FileSpreadsheet,
  FoldHorizontal,
  LayoutGrid,
  Package,
  Weight,
} from "lucide-react";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import type { BendPlateQuoteItem } from "../bend-plate/types";
import type { ManualQuotePartRow, QuoteCreationMethod } from "../types/quickQuote";
import { jobSummaryFromParts } from "../lib/deriveQuoteSelection";
import { mergeAllQuoteMethodParts } from "../lib/mergeAllQuoteMethods";
import { dxfMethodHasQuotableParts } from "../lib/dxfQuoteParts";
import { MethodPhaseMetricStrip } from "./method-phases/MethodPhaseMetricStrip";
import { t } from "@/lib/i18n";

const OPTIONS: {
  id: QuoteCreationMethod;
  i18nPrefix: "dxf" | "manualAdd" | "excelImport" | "bendPlate";
  Icon: typeof FileCode2;
}[] = [
  { id: "dxf", i18nPrefix: "dxf", Icon: FileCode2 },
  { id: "manualAdd", i18nPrefix: "manualAdd", Icon: ClipboardList },
  { id: "excelImport", i18nPrefix: "excelImport", Icon: FileSpreadsheet },
  { id: "bendPlate", i18nPrefix: "bendPlate", Icon: FoldHorizontal },
];

const VIEWPORT = "flex h-full min-h-0 max-h-full flex-col overflow-hidden";

function methodHasData(
  method: QuoteCreationMethod,
  manualQuoteRows: ManualQuotePartRow[],
  excelImportQuoteRows: ManualQuotePartRow[],
  dxfMethodGeometries: DxfPartGeometry[],
  bendPlateQuoteItems: BendPlateQuoteItem[]
): boolean {
  switch (method) {
    case "dxf":
      return dxfMethodHasQuotableParts(dxfMethodGeometries);
    case "manualAdd":
      return manualQuoteRows.length > 0;
    case "excelImport":
      return excelImportQuoteRows.length > 0;
    case "bendPlate":
      return bendPlateQuoteItems.length > 0;
    default:
      return false;
  }
}

interface QuoteMethodPickerPhaseProps {
  materialType: MaterialType;
  manualQuoteRows: ManualQuotePartRow[];
  excelImportQuoteRows: ManualQuotePartRow[];
  dxfMethodGeometries: DxfPartGeometry[];
  bendPlateQuoteItems: BendPlateQuoteItem[];
  selected: QuoteCreationMethod | null;
  onSelect: (method: QuoteCreationMethod) => void;
  onConfigureMethod: (method: QuoteCreationMethod) => void;
}

export function QuoteMethodPickerPhase({
  materialType,
  manualQuoteRows,
  excelImportQuoteRows,
  dxfMethodGeometries,
  bendPlateQuoteItems,
  selected: _selected,
  onSelect,
  onConfigureMethod,
}: QuoteMethodPickerPhaseProps) {
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
              {t("quoteMethodScreen.title")}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("quoteMethodScreen.intro")}
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
          <div
            className="shrink-0 border-b border-white/[0.08] bg-card/45 px-4 py-3.5 sm:px-6 sm:py-4"
            dir="rtl"
          >
            <p className="text-sm leading-relaxed text-foreground/90 sm:text-[15px]">
              {t("quoteMethodScreen.methodsStripe")}
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-4 sm:p-5">
            <div
              className={cn(
                "grid min-h-0 flex-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4",
                "[grid-auto-rows:minmax(0,1fr)]"
              )}
            >
              {OPTIONS.map(({ id, i18nPrefix, Icon }) => {
                const title = t(`quote.methods.${i18nPrefix}.title`);
                const hasData = methodHasData(
                  id,
                  manualQuoteRows,
                  excelImportQuoteRows,
                  dxfMethodGeometries,
                  bendPlateQuoteItems
                );
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onSelect(id);
                      onConfigureMethod(id);
                    }}
                    aria-label={title}
                    className={cn(
                      "group flex h-full min-h-[14rem] min-w-0 flex-col items-center justify-center rounded-xl border-2 bg-card p-5 text-center transition-all duration-150",
                      "cursor-pointer hover:border-primary/50 hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      hasData &&
                        "border-primary/70 shadow-sm ring-1 ring-primary/20",
                      !hasData && "border-white/[0.08]"
                    )}
                  >
                    <div
                      className={cn(
                        "mb-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                        hasData
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground group-hover:bg-muted/90"
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
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
