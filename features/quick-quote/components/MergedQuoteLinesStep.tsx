"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFooterActionsStartClassName,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import type { BendPlateQuoteItem } from "../bend-plate/types";
import type { QuotePartRow } from "../types/quickQuote";
import { PartBreakdownTable, type PartPackageExportContext } from "./PartBreakdownTable";

const VIEWPORT = "flex h-full min-h-0 max-h-full flex-col overflow-hidden";
const PP = "quote.partsPhase" as const;

interface MergedQuoteLinesStepProps {
  parts: QuotePartRow[];
  currency: string;
  dxfMethodGeometries: DxfPartGeometry[];
  onDeletePart: (row: QuotePartRow) => void;
  onReset: () => void;
  canReset: boolean;
  /** Optional header copy (default: quote.partsPhase title/subtitle). */
  headerTitle?: string;
  headerSubtitle?: string;
  materialType: MaterialType;
  bendPlateQuoteItems: BendPlateQuoteItem[];
  referenceNumber: string;
  customerName?: string;
  /** Quick quote step 3 hides this; plate-project summary keeps it. */
  showFullExecutionPackageButton?: boolean;
  /** Quick quote step 3: hide per-row "ייצא קובץ"; plate project shows it. */
  showPerRowFileExport?: boolean;
}

export function MergedQuoteLinesStep({
  parts,
  currency,
  dxfMethodGeometries,
  onDeletePart,
  onReset,
  canReset,
  headerTitle,
  headerSubtitle,
  materialType,
  bendPlateQuoteItems,
  referenceNumber,
  customerName,
  showFullExecutionPackageButton = true,
  showPerRowFileExport = true,
}: MergedQuoteLinesStepProps) {
  const [resetOpen, setResetOpen] = useState(false);

  const partPackageExport: PartPackageExportContext = {
    materialType,
    bendPlateQuoteItems,
    referenceNumber,
    customerName,
  };

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-0 overflow-hidden",
        VIEWPORT
      )}
      dir="rtl"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="shrink-0 bg-background px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1 text-right">
              <h2 className="text-base font-semibold text-foreground">
                {headerTitle ?? t(`${PP}.title`)}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {headerSubtitle ?? t(`${PP}.subtitle`)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={!canReset}
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  {t(`${PP}.resetSession`)}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/*
          No padding-top on this scroller: top padding on overflow:auto creates a fixed inset so
          sticky table headers sit below a visible gap. Use horizontal + bottom padding only;
          top spacing is scrollable margin on children.
        */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain px-4 pb-4 pt-0 sm:px-5 sm:pb-5 sm:pt-0">
          {parts.length === 0 ? (
            <div className="flex min-h-[min(280px,40vh)] flex-col items-center justify-center ds-empty-state px-2 pt-4 text-center sm:pt-5">
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                {t(`${PP}.emptyMerged`)}
              </p>
            </div>
          ) : (
            <PartBreakdownTable
              parts={parts}
              currency={currency}
              onDeletePart={onDeletePart}
              dxfPartGeometries={dxfMethodGeometries}
              partPackageExport={partPackageExport}
              showPerRowFileExport={showPerRowFileExport}
              showFullExecutionPackageButton={showFullExecutionPackageButton}
            />
          )}
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent
          showCloseButton={false}
          dir="rtl"
          className="gap-6 rounded-md border border-border bg-card p-7 text-card-foreground shadow-xl sm:max-w-md sm:rounded-md sm:p-8"
        >
          <DialogHeader className="sm:text-start">
            <DialogTitle>{t(`${PP}.confirmResetTitle`)}</DialogTitle>
            <DialogDescription>{t(`${PP}.confirmResetDescription`)}</DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn(dialogFooterActionsStartClassName)}>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setResetOpen(false);
                onReset();
              }}
            >
              {t(`${PP}.resetSession`)}
            </Button>
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              {t(`${PP}.cancel`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
