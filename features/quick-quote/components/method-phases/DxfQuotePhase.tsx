"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, RotateCcw } from "lucide-react";
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
import type { DxfMethodExcelSnapshot } from "../../types/quickQuote";
import {
  DxfUploadStep,
  type DxfPhaseMetricsPayload,
  type DxfUploadNavState,
  type DxfUploadStepHandle,
} from "../DxfUploadStep";
import { MethodPhaseMetricStrip } from "./MethodPhaseMetricStrip";

interface DxfQuotePhaseProps {
  materialType: MaterialType;
  /** Parent copy of approved DXF parts — used to restore the upload/review UI when returning after Complete. */
  savedDxfGeometries: DxfPartGeometry[];
  /** Optional Excel BOM persisted with the DXF method session. */
  savedDxfExcel: DxfMethodExcelSnapshot | null;
  onSavedDxfExcelChange: (payload: DxfMethodExcelSnapshot | null) => void;
  onGeometriesApproved: (data: DxfPartGeometry[]) => void;
  onBack: () => void;
  onComplete: () => void;
}

const MANUAL_PHASE_VIEWPORT =
  "flex h-full min-h-0 max-h-full flex-col overflow-hidden";

const defaultMetrics: DxfPhaseMetricsPayload = {
  totalQuantity: 0,
  totalAreaM2: 0,
  totalWeightKg: 0,
  dxfFileCount: 0,
};

/**
 * Quote method “DXF import” — same shell as manual / Excel (aside metrics + header Back / Complete).
 */
export function DxfQuotePhase({
  materialType,
  savedDxfGeometries,
  savedDxfExcel,
  onSavedDxfExcelChange,
  onGeometriesApproved,
  onBack,
  onComplete,
}: DxfQuotePhaseProps) {
  const dxfRef = useRef<DxfUploadStepHandle>(null);
  const [phaseMetrics, setPhaseMetrics] =
    useState<DxfPhaseMetricsPayload>(defaultMetrics);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationLines, setValidationLines] = useState<string[]>([]);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [dxfNavState, setDxfNavState] = useState<DxfUploadNavState | null>(null);

  const plateTypeLabel = MATERIAL_TYPE_LABELS[materialType];

  const handlePhaseMetricsChange = useCallback((payload: DxfPhaseMetricsPayload) => {
    setPhaseMetrics(payload);
  }, []);

  const handleExcelSessionPersist = useCallback(
    (payload: DxfMethodExcelSnapshot | null) => {
      onSavedDxfExcelChange(payload);
    },
    [onSavedDxfExcelChange]
  );

  const handleDxfNavStateChange = useCallback((state: DxfUploadNavState) => {
    setDxfNavState(state);
  }, []);

  const handleSessionReset = useCallback(() => {
    onGeometriesApproved([]);
    onSavedDxfExcelChange(null);
  }, [onGeometriesApproved, onSavedDxfExcelChange]);

  function handleBackClick() {
    if (dxfRef.current?.canLeaveWithoutConfirm()) {
      onBack();
      return;
    }
    setBackConfirmOpen(true);
  }

  function confirmBack() {
    setBackConfirmOpen(false);
    onBack();
  }

  function handlePrimaryActionClick() {
    if (!dxfNavState) return;
    if (dxfNavState.isReviewStep) {
      if (dxfRef.current?.attemptComplete()) {
        onComplete();
        return;
      }
      setValidationLines([
        "Add at least one valid DXF part on the Review step before completing. Fix parse errors or adjust quantities as needed.",
      ]);
      setValidationDialogOpen(true);
      return;
    }
    if (dxfRef.current?.attemptNext()) {
      return;
    }
    setValidationLines([
      "Add at least one DXF file before continuing, or finish the Excel column mapping dialog.",
    ]);
    setValidationDialogOpen(true);
  }

  function handleResetClick() {
    setResetConfirmOpen(true);
  }

  function confirmResetSession() {
    setResetConfirmOpen(false);
    dxfRef.current?.resetSession();
  }

  const primaryDisabled =
    dxfNavState == null
      ? true
      : dxfNavState.isReviewStep
        ? !dxfNavState.canCompleteReview
        : !dxfNavState.canGoNext;

  const asideMetrics = useMemo(
    () => ({
      qtyLabel: formatInteger(phaseMetrics.totalQuantity),
      areaLabel: formatDecimal(phaseMetrics.totalAreaM2, 2),
      weightLabel: formatDecimal(phaseMetrics.totalWeightKg, 1),
      fileLabel: formatInteger(phaseMetrics.dxfFileCount),
    }),
    [phaseMetrics]
  );

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-0 overflow-hidden",
        MANUAL_PHASE_VIEWPORT
      )}
    >
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <aside className="flex h-full min-h-0 w-full max-w-[min(420px,42vw)] shrink-0 flex-col border-r border-border/80">
          <div className="shrink-0 space-y-2 px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-snug">
              DXF import
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload DXF files, parse geometry, then review quantities and finishes before merging
              into the quote.
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Plate type from General:{" "}
              <span className="font-medium text-foreground">{plateTypeLabel}</span>
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col divide-y divide-border/70">
            <MethodPhaseMetricStrip
              label="Quantity"
              value={asideMetrics.qtyLabel}
            />
            <MethodPhaseMetricStrip
              label="Area (m²)"
              value={asideMetrics.areaLabel}
            />
            <MethodPhaseMetricStrip
              label="Weight (kg)"
              value={asideMetrics.weightLabel}
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="shrink-0 ds-surface-header sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">Upload &amp; review</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {asideMetrics.fileLabel} DXF file
                  {phaseMetrics.dxfFileCount === 1 ? "" : "s"} in session · scroll the panel below
                  when the list grows.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="gap-2"
                  onClick={handleBackClick}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="gap-2"
                  onClick={handleResetClick}
                  disabled={dxfNavState != null && !dxfNavState.canReset}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  type="button"
                  size="default"
                  className="gap-2"
                  disabled={primaryDisabled}
                  onClick={handlePrimaryActionClick}
                >
                  {dxfNavState?.isReviewStep ? (
                    <>
                      <Check className="h-4 w-4" />
                      Complete
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      Next
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-4 sm:p-5">
              <DxfUploadStep
                ref={dxfRef}
                materialType={materialType}
                onDataApproved={onGeometriesApproved}
                onPhaseMetricsChange={handlePhaseMetricsChange}
                restoredGeometries={
                  savedDxfGeometries.length > 0 ? savedDxfGeometries : undefined
                }
                restoredExcelBundle={savedDxfExcel ?? undefined}
                onExcelSessionPersist={handleExcelSessionPersist}
                hideBottomNavigation
                onDxfNavStateChange={handleDxfNavStateChange}
                onSessionReset={handleSessionReset}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finish DXF review first</DialogTitle>
            <DialogDescription>
              Fix the following before you can complete this step.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
            {validationLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" onClick={() => setValidationDialogOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset DXF import?</DialogTitle>
            <DialogDescription>
              This clears all uploaded DXF files, optional Excel mapping, and review data, and returns
              you to the first step.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmResetSession}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave DXF import?</DialogTitle>
            <DialogDescription>
              You have files, Excel match, or progress in this step. Going back returns to quote
              methods; this DXF session will reset when you open it again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setBackConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="default" onClick={confirmBack}>
              Leave and go back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
