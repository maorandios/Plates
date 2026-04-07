"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Package,
  RotateCcw,
  Weight,
} from "lucide-react";
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
import type { MaterialType } from "@/types/materials";
import type { DxfMethodExcelSnapshot } from "../../types/quickQuote";
import {
  DxfUploadStep,
  type DxfPhaseMetricsPayload,
  type DxfUploadNavState,
  type DxfUploadStepHandle,
} from "../DxfUploadStep";
import { MethodPhaseMetricStrip } from "./MethodPhaseMetricStrip";
import { t } from "@/lib/i18n";

interface DxfQuotePhaseProps {
  materialType: MaterialType;
  savedDxfGeometries: DxfPartGeometry[];
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
    if (dxfRef.current?.attemptBackWithinPhase()) {
      return;
    }
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
      dir="rtl"
    >
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <aside className="flex h-full min-h-0 w-full max-w-[min(336px,33.6vw)] shrink-0 flex-col border-e border-white/[0.08] bg-card/60">
          <div className="shrink-0 space-y-2 px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-snug">
              {t("quote.dxfPhase.sidebarTitle")}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("quote.dxfPhase.sidebarIntro")}
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col divide-y divide-white/[0.06]">
            <MethodPhaseMetricStrip
              icon={Package}
              label={t("methodMetrics.quantity")}
              value={asideMetrics.qtyLabel}
            />
            <MethodPhaseMetricStrip
              icon={LayoutGrid}
              label={t("methodMetrics.area")}
              value={asideMetrics.areaLabel}
              valueUnit={t("methodMetrics.unitM2")}
            />
            <MethodPhaseMetricStrip
              icon={Weight}
              label={t("methodMetrics.weight")}
              value={asideMetrics.weightLabel}
              valueUnit={t("methodMetrics.unitKg")}
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="shrink-0 border-b border-white/[0.08] bg-card/45 px-4 py-3.5 sm:px-6 sm:py-4">
            <p className="text-sm leading-relaxed text-foreground/90 sm:text-[15px]">
              {t("quote.dxfPhase.stripe")}
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-4 sm:p-5">
            {/* Fills scroll viewport so DXF + Excel upload cards get real height for vertical centering */}
            <div className="flex min-h-0 flex-1 flex-col">
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
                hideSubStepper
                dxfQuotePhaseLayout
                onDxfNavStateChange={handleDxfNavStateChange}
                onSessionReset={handleSessionReset}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Full viewport width — same pattern as method picker: sidebar ends above this bar */}
      <div
        className="shrink-0 border-t border-white/[0.08] bg-card/60 px-4 py-3 sm:px-5"
        dir="ltr"
      >
        <div className="flex flex-wrap items-center justify-start gap-2">
          <Button
            type="button"
            className="gap-2"
            disabled={primaryDisabled}
            onClick={handlePrimaryActionClick}
          >
            {dxfNavState?.isReviewStep ? (
              <>
                <Check className="h-4 w-4" aria-hidden />
                {t("quote.dxfPhase.complete")}
              </>
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" aria-hidden />
                {t("quote.dxfPhase.next")}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="inline-flex flex-row gap-2"
            onClick={handleBackClick}
          >
            <span>{t("quote.dxfPhase.back")}</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleResetClick}
            disabled={dxfNavState != null && !dxfNavState.canReset}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t("quote.dxfPhase.reset")}
          </Button>
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
