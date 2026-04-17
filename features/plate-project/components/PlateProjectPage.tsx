"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GeneralSection } from "@/features/quick-quote/components/GeneralSection";
import { BendPlateQuotePhase } from "@/features/quick-quote/components/method-phases/BendPlateQuotePhase";
import { generateQuoteReference } from "@/features/quick-quote/lib/generateQuoteReference";
import type { BendPlateQuoteItem, BendTemplateId } from "@/features/quick-quote/bend-plate/types";
import type {
  ManualQuotePartRow,
  QuickQuoteJobDetails,
} from "@/features/quick-quote/types/quickQuote";
import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import { t } from "@/lib/i18n";
import type { PlateProjectStep } from "../types/plateProject";
import { PlateProjectBottomBar } from "./PlateProjectBottomBar";
import { PlateProjectDrawingPickerPhase } from "./PlateProjectDrawingPickerPhase";
import { PlateProjectStepper } from "./PlateProjectStepper";

const defaultJobDetails: QuickQuoteJobDetails = {
  referenceNumber: "",
  projectName: "",
  customerName: "",
  currency: "EUR",
  notes: "",
};

type PlateProjectPhase2Mode = "drawingPicker" | "bendWorkspace";

export function PlateProjectPage() {
  const router = useRouter();
  const [leaveWizardDialogOpen, setLeaveWizardDialogOpen] = useState(false);
  const pendingNavigationHrefRef = useRef<string | null>(null);
  const [step, setStep] = useState<PlateProjectStep>(1);
  const [highestStepReached, setHighestStepReached] = useState<PlateProjectStep>(1);

  const [phase2Mode, setPhase2Mode] = useState<PlateProjectPhase2Mode>("drawingPicker");
  const [bendBuilderKey, setBendBuilderKey] = useState(0);
  const [bendInitialTemplate, setBendInitialTemplate] = useState<BendTemplateId | null>(null);

  const pageMainScrollRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const shell = document.getElementById("app-shell-scroll");
    if (shell) shell.scrollTop = 0;
    const main = pageMainScrollRef.current;
    if (main) main.scrollTop = 0;
  }, [step, phase2Mode]);

  const [jobDetails, setJobDetails] = useState<QuickQuoteJobDetails>(() => ({
    ...defaultJobDetails,
    referenceNumber: generateQuoteReference(),
  }));
  const [materialType, setMaterialType] = useState<MaterialType>("carbonSteel");

  const [manualQuoteRows, setManualQuoteRows] = useState<ManualQuotePartRow[]>([]);
  const [excelImportQuoteRows, setExcelImportQuoteRows] = useState<ManualQuotePartRow[]>([]);
  const [dxfMethodGeometries, setDxfMethodGeometries] = useState<DxfPartGeometry[]>([]);
  const [bendPlateQuoteItems, setBendPlateQuoteItems] = useState<BendPlateQuoteItem[]>([]);
  const [phase2ResetDialogOpen, setPhase2ResetDialogOpen] = useState(false);

  const handleBendPlateAddItem = useCallback((item: BendPlateQuoteItem) => {
    setBendPlateQuoteItems((prev) => [...prev, item]);
  }, []);

  const handleBendPlateUpdateItem = useCallback((item: BendPlateQuoteItem) => {
    setBendPlateQuoteItems((prev) => prev.map((x) => (x.id === item.id ? item : x)));
  }, []);

  const handleBendPlateRemoveItem = useCallback((id: string) => {
    setBendPlateQuoteItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const handleBendPlateResetAll = useCallback(() => {
    setBendPlateQuoteItems([]);
  }, []);

  const hasPhase2Data = useMemo(
    () =>
      bendPlateQuoteItems.length > 0 ||
      manualQuoteRows.length > 0 ||
      excelImportQuoteRows.length > 0 ||
      dxfMethodGeometries.length > 0,
    [
      bendPlateQuoteItems.length,
      manualQuoteRows.length,
      excelImportQuoteRows.length,
      dxfMethodGeometries.length,
    ]
  );

  const confirmPhase2Reset = useCallback(() => {
    setBendPlateQuoteItems([]);
    setManualQuoteRows([]);
    setExcelImportQuoteRows([]);
    setDxfMethodGeometries([]);
    setPhase2Mode("drawingPicker");
    setBendInitialTemplate(null);
    setBendBuilderKey((k) => k + 1);
    setPhase2ResetDialogOpen(false);
  }, []);

  const advanceTo = useCallback((s: PlateProjectStep) => {
    setStep(s);
    setHighestStepReached((h) => (s > h ? s : h));
  }, []);

  const goToStep = useCallback(
    (s: PlateProjectStep) => {
      if (s <= highestStepReached) {
        setStep(s);
        if (s < 2) {
          setPhase2Mode("drawingPicker");
          setBendInitialTemplate(null);
        }
      }
    },
    [highestStepReached]
  );

  const handleContinueFromGeneral = useCallback(() => {
    setPhase2Mode("drawingPicker");
    setBendInitialTemplate(null);
    advanceTo(2);
  }, [advanceTo]);

  const handleBackFromCreatePlansPicker = useCallback(() => {
    setPhase2Mode("drawingPicker");
    setBendInitialTemplate(null);
    advanceTo(1);
  }, [advanceTo]);

  const openBendWorkspace = useCallback((template: BendTemplateId | null) => {
    setBendInitialTemplate(template);
    setBendBuilderKey((k) => k + 1);
    setPhase2Mode("bendWorkspace");
  }, []);

  const closeBendWorkspaceToPicker = useCallback(() => {
    setPhase2Mode("drawingPicker");
    setBendInitialTemplate(null);
  }, []);

  const canContinueFromGeneral = useMemo(
    () =>
      jobDetails.projectName.trim().length > 0 &&
      jobDetails.customerName.trim().length > 0,
    [jobDetails.projectName, jobDetails.customerName]
  );

  const stepNav = useMemo(() => {
    switch (step) {
      case 1:
        return {
          showBack: false,
          showContinue: true,
          canContinue: canContinueFromGeneral,
          onContinue: handleContinueFromGeneral,
        };
      case 2:
        if (phase2Mode === "bendWorkspace") {
          return {
            showBack: false,
            showContinue: false,
            canContinue: false,
          };
        }
        return {
          showBack: true,
          showContinue: false,
          canContinue: false,
          onBack: handleBackFromCreatePlansPicker,
        };
      case 3:
        return {
          showBack: true,
          showContinue: false,
          canContinue: false,
          onBack: () => advanceTo(2),
        };
      default:
        return {
          showBack: false,
          showContinue: false,
          canContinue: false,
        };
    }
  }, [
    step,
    phase2Mode,
    canContinueFromGeneral,
    handleContinueFromGeneral,
    handleBackFromCreatePlansPicker,
    advanceTo,
  ]);

  const shouldWarnOnLeave = step > 1;

  useEffect(() => {
    if (!shouldWarnOnLeave) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [shouldWarnOnLeave]);

  useEffect(() => {
    if (!shouldWarnOnLeave) return;
    const onDocClickCapture = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
      try {
        const u = new URL(href, window.location.origin);
        if (u.origin !== window.location.origin) return;
        if (u.pathname === "/plate-project" || u.pathname.startsWith("/plate-project/")) {
          return;
        }
        const path = `${u.pathname}${u.search}${u.hash}`;
        e.preventDefault();
        e.stopPropagation();
        pendingNavigationHrefRef.current = path;
        setLeaveWizardDialogOpen(true);
      } catch {
        return;
      }
    };
    document.addEventListener("click", onDocClickCapture, true);
    return () => document.removeEventListener("click", onDocClickCapture, true);
  }, [shouldWarnOnLeave]);

  const handleLeaveWizardConfirm = useCallback(() => {
    const path = pendingNavigationHrefRef.current;
    pendingNavigationHrefRef.current = null;
    setLeaveWizardDialogOpen(false);
    if (path) router.push(path);
  }, [router]);

  const handleLeaveWizardStay = useCallback(() => {
    pendingNavigationHrefRef.current = null;
    setLeaveWizardDialogOpen(false);
  }, []);

  const step2FullBleed = step === 2;

  return (
    <div dir="rtl" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PlateProjectStepper
        currentStep={step}
        highestStepReached={highestStepReached}
        onStepSelect={goToStep}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageContainer
          ref={pageMainScrollRef}
          className={cn(
            "bg-background min-h-0 flex-1",
            step2FullBleed
              ? "flex flex-col overflow-hidden p-0 lg:p-0"
              : "overflow-y-auto space-y-8"
          )}
        >
          {step === 1 && (
            <Card className="mx-auto w-full max-w-xl border-0 shadow-sm">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-xl tracking-tight">
                  {t("plateProject.generalTitle")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("plateProject.generalSubtitle")}
                </p>
              </CardHeader>
              <CardContent>
                <GeneralSection
                  value={jobDetails}
                  materialType={materialType}
                  onChange={setJobDetails}
                  onMaterialTypeChange={setMaterialType}
                />
              </CardContent>
            </Card>
          )}

          {step === 2 && phase2Mode === "drawingPicker" && (
            <div
              className={cn(
                "flex min-h-0 w-full flex-1 flex-col",
                "overflow-hidden"
              )}
            >
              <PlateProjectDrawingPickerPhase
                materialType={materialType}
                manualQuoteRows={manualQuoteRows}
                excelImportQuoteRows={excelImportQuoteRows}
                dxfMethodGeometries={dxfMethodGeometries}
                bendPlateQuoteItems={bendPlateQuoteItems}
                onSelectTemplate={(id) => openBendWorkspace(id)}
                onResetRequest={() => setPhase2ResetDialogOpen(true)}
                resetDisabled={!hasPhase2Data}
              />
            </div>
          )}

          {step === 2 && phase2Mode === "bendWorkspace" && (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <BendPlateQuotePhase
                key={bendBuilderKey}
                materialType={materialType}
                quoteItems={bendPlateQuoteItems}
                onAddItem={handleBendPlateAddItem}
                onUpdateItem={handleBendPlateUpdateItem}
                onRemoveItem={handleBendPlateRemoveItem}
                onResetAll={handleBendPlateResetAll}
                onBack={closeBendWorkspaceToPicker}
                onComplete={closeBendWorkspaceToPicker}
                initialEditorTemplate={bendInitialTemplate}
              />
            </div>
          )}

          {step === 3 && (
            <Card className="mx-auto w-full max-w-xl border-0 shadow-sm">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-xl tracking-tight">
                  {t("plateProject.finishTitle")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("plateProject.finishSubtitle")}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("plateProject.finishPlaceholder")}
                </p>
              </CardContent>
            </Card>
          )}
        </PageContainer>
        <PlateProjectBottomBar
          currentStep={step}
          showBack={stepNav.showBack ?? false}
          showContinue={stepNav.showContinue ?? false}
          canContinue={stepNav.canContinue ?? false}
          onBack={stepNav.onBack}
          onContinue={stepNav.onContinue}
        />
      </div>

      <Dialog
        open={leaveWizardDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleLeaveWizardStay();
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t("plateProject.leaveWizardTitle")}</DialogTitle>
            <DialogDescription className="text-start text-sm leading-relaxed">
              {t("plateProject.leaveWizardConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row flex-wrap gap-2">
            <Button type="button" variant="destructive" onClick={handleLeaveWizardConfirm}>
              {t("plateProject.leaveWizardLeave")}
            </Button>
            <Button type="button" variant="outline" onClick={handleLeaveWizardStay}>
              {t("plateProject.leaveWizardStay")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={phase2ResetDialogOpen}
        onOpenChange={(open) => {
          if (!open) setPhase2ResetDialogOpen(false);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md" dir="rtl">
          <DialogHeader className="sm:text-start">
            <DialogTitle>{t("plateProject.drawingPhase.confirmResetTitle")}</DialogTitle>
            <DialogDescription className="text-start text-sm leading-relaxed">
              {t("plateProject.drawingPhase.confirmResetDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start sm:gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => setPhase2ResetDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={confirmPhase2Reset}>
              {t("plateProject.drawingPhase.confirmResetAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
