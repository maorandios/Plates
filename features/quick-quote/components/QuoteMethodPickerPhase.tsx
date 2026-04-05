"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, ClipboardList, FileCode2, FileSpreadsheet, FoldHorizontal, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import type { DxfPartGeometry } from "@/types";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/types/materials";
import type { BendPlateQuoteItem } from "../bend-plate/types";
import type { ManualQuotePartRow, QuoteCreationMethod } from "../types/quickQuote";
import { jobSummaryFromParts } from "../lib/deriveQuoteSelection";
import { mergeAllQuoteMethodParts } from "../lib/mergeAllQuoteMethods";
import { dxfMethodHasQuotableParts } from "../lib/dxfQuoteParts";
import { MethodPhaseMetricStrip } from "./method-phases/MethodPhaseMetricStrip";

const OPTIONS: {
  id: QuoteCreationMethod;
  title: string;
  description: string;
  hint: string;
  Icon: typeof FileCode2;
}[] = [
  {
    id: "dxf",
    title: "DXF",
    description: "Upload DXF files for quoting",
    hint: "Best for ready CAD files",
    Icon: FileCode2,
  },
  {
    id: "manualAdd",
    title: "Manually add",
    description: "Add part data manually",
    hint: "Width, length, thickness, qty, material",
    Icon: ClipboardList,
  },
  {
    id: "excelImport",
    title: "Import Excel list",
    description: "Upload a spreadsheet and map columns",
    hint: "CSV or Excel — same mapping flow as DXF BOM",
    Icon: FileSpreadsheet,
  },
  {
    id: "bendPlate",
    title: "Bend plate",
    description: "Build a bent plate from a side profile or template",
    hint: "Geometry for quoting from your profile",
    Icon: FoldHorizontal,
  },
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
  onBack: () => void;
  onReset: () => void;
  onComplete: () => void;
  canComplete: boolean;
  canReset: boolean;
}

export function QuoteMethodPickerPhase({
  materialType,
  manualQuoteRows,
  excelImportQuoteRows,
  dxfMethodGeometries,
  bendPlateQuoteItems,
  selected,
  onSelect,
  onConfigureMethod,
  onBack,
  onReset,
  onComplete,
  canComplete,
  canReset,
}: QuoteMethodPickerPhaseProps) {
  const [resetOpen, setResetOpen] = useState(false);

  const plateTypeLabel = MATERIAL_TYPE_LABELS[materialType];

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
        "flex w-full max-w-[1800px] mx-auto flex-col gap-0 overflow-hidden",
        VIEWPORT
      )}
    >
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <aside className="flex h-full min-h-0 w-full max-w-[min(420px,42vw)] shrink-0 flex-col border-r border-white/[0.08] bg-card/60">
          <div className="shrink-0 space-y-2 px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-snug">
              Quote method
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Choose how you build this quote. Configure each method to add parts, then complete to
              review all lines together.
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Plate type from General:{" "}
              <span className="font-medium text-foreground">{plateTypeLabel}</span>
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col divide-y divide-white/[0.06]">
            <MethodPhaseMetricStrip
              label="Quantity"
              value={formatInteger(metrics.totalQty)}
              sub="Sum of quantities across all methods with data"
            />
            <MethodPhaseMetricStrip
              label="Area (m²)"
              value={formatDecimal(metrics.totalPlateAreaM2, 2)}
              sub="Total plate area from merged quote lines"
            />
            <MethodPhaseMetricStrip
              label="Weight (kg)"
              value={formatDecimal(metrics.totalEstWeightKg, 1)}
              sub="Estimated weight from merged lines (General density)"
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="shrink-0 border-b border-white/[0.08] bg-card/40 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">Methods</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  A green border means that method already has quote data. Use Configure to edit.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button type="button" variant="outline" className="gap-2" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={!canReset}
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  type="button"
                  size="default"
                  className="gap-2"
                  disabled={!canComplete}
                  onClick={onComplete}
                >
                  <Check className="h-4 w-4" />
                  Complete
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
              {OPTIONS.map(({ id, title, description, hint, Icon }) => {
                const isSelected = selected === id;
                const hasData = methodHasData(
                  id,
                  manualQuoteRows,
                  excelImportQuoteRows,
                  dxfMethodGeometries,
                  bendPlateQuoteItems
                );
                return (
                  <div
                    key={id}
                    className={cn(
                      "flex flex-col rounded-xl border-2 bg-card p-5 text-left transition-all duration-150",
                      hasData &&
                        "border-primary/70 shadow-sm ring-1 ring-primary/20",
                      !hasData && "border-white/[0.08]",
                      isSelected && "ring-2 ring-primary/35 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.35)]"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(id)}
                      className="text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg -m-1 p-1"
                    >
                      <div
                        className={cn(
                          "mb-3 flex h-11 w-11 items-center justify-center rounded-xl",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <span className="text-base font-semibold text-foreground">{title}</span>
                      <span className="mt-2 block text-sm text-muted-foreground leading-snug">
                        {description}
                      </span>
                      <span className="mt-2 block text-xs text-muted-foreground/90 leading-snug">
                        {hint}
                      </span>
                    </button>
                    <div className="mt-4 pt-3 border-t border-white/[0.08]">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          onSelect(id);
                          onConfigureMethod(id);
                        }}
                      >
                        Configure
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset all quote methods?</DialogTitle>
            <DialogDescription>
              This clears DXF, manual, Excel import, and bend-plate data for this quote. You will
              return to an empty state on this screen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setResetOpen(false);
                onReset();
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
