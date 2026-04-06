"use client";

import { useCallback, useState } from "react";
import { Package, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DxfPartGeometry } from "@/types";
import type { BendPlateQuoteItem } from "../bend-plate/types";
import type { QuotePartRow } from "../types/quickQuote";
import { PartBreakdownTable } from "./PartBreakdownTable";
import { exportPartsPackage } from "@/lib/quotes/exportPartsPackage";

const VIEWPORT = "flex h-full min-h-0 max-h-full flex-col overflow-hidden";

interface MergedQuoteLinesStepProps {
  parts: QuotePartRow[];
  currency: string;
  referenceNumber: string;
  dxfMethodGeometries: DxfPartGeometry[];
  bendPlateQuoteItems: BendPlateQuoteItem[];
  onDeletePart: (row: QuotePartRow) => void;
  onReset: () => void;
  canReset: boolean;
}

export function MergedQuoteLinesStep({
  parts,
  currency,
  referenceNumber,
  dxfMethodGeometries,
  bendPlateQuoteItems,
  onDeletePart,
  onReset,
  canReset,
}: MergedQuoteLinesStepProps) {
  const [resetOpen, setResetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportPackage = useCallback(async () => {
    if (parts.length === 0 || exporting) return;
    setExporting(true);
    try {
      await exportPartsPackage(
        parts,
        dxfMethodGeometries,
        bendPlateQuoteItems,
        referenceNumber
      );
    } finally {
      setExporting(false);
    }
  }, [parts, dxfMethodGeometries, bendPlateQuoteItems, referenceNumber, exporting]);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-0 overflow-hidden",
        VIEWPORT
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="shrink-0 ds-surface-header">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Parts</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Combined plates from every quote method. Continue when you are ready for stock &amp; pricing.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                variant="outline"
                className="gap-2"
                disabled={parts.length === 0 || exporting}
                onClick={handleExportPackage}
              >
                <Package className="h-4 w-4" />
                {exporting ? "Building…" : "Export package"}
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          {parts.length === 0 ? (
            <div className="flex min-h-[min(280px,40vh)] flex-col items-center justify-center ds-empty-state text-center">
              <p className="text-sm text-muted-foreground max-w-md">
                No quote lines yet. Go back and configure at least one method with parts before
                continuing.
              </p>
            </div>
          ) : (
            <PartBreakdownTable
              parts={parts}
              currency={currency}
              onDeletePart={onDeletePart}
            />
          )}
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset all quote data?</DialogTitle>
            <DialogDescription>
              This clears every method and returns you to the quote method screen.
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
