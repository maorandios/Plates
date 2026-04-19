"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  QuotePartRow,
} from "@/features/quick-quote/types/quickQuote";
import { MergedQuoteLinesStep } from "@/features/quick-quote/components/MergedQuoteLinesStep";
import { mergeAllQuoteMethodParts } from "@/features/quick-quote/lib/mergeAllQuoteMethods";
import { jobSummaryFromParts } from "@/features/quick-quote/lib/deriveQuoteSelection";
import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import { t } from "@/lib/i18n";
import type { PlateProjectStep } from "../types/plateProject";
import {
  getPlateProjectSnapshot,
  savePlateProjectSnapshot,
  type PlateProjectPhase2Mode,
} from "@/lib/projects/plateProjectSnapshot";
import {
  getPlateProjectsList,
  patchPlateProjectListRecord,
  upsertPlateProjectInProgress,
} from "@/lib/projects/plateProjectList";
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

function newPlateProjectSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function PlateProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get("id");
  const pendingNewIdRef = useRef<string | null>(null);
  const projectId =
    urlId ?? (pendingNewIdRef.current ??= newPlateProjectSessionId());
  const hydratedUrlRef = useRef<string | null>(null);
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
  /** Projects list row is created/updated only after explicit save on step 3 (like quotes). */
  const [projectSavedToList, setProjectSavedToList] = useState(false);

  useLayoutEffect(() => {
    if (!urlId) {
      router.replace(`/plate-project?id=${projectId}`, { scroll: false });
    }
  }, [urlId, projectId, router]);

  useLayoutEffect(() => {
    if (!urlId) return;
    if (getPlateProjectsList().some((p) => p.id === urlId)) {
      setProjectSavedToList(true);
    }
  }, [urlId]);

  useLayoutEffect(() => {
    if (!urlId) return;
    if (hydratedUrlRef.current === urlId) return;
    const snap = getPlateProjectSnapshot(urlId);
    if (snap) {
      setJobDetails(snap.jobDetails);
      setMaterialType(snap.materialType);
      setManualQuoteRows(snap.manualQuoteRows);
      setExcelImportQuoteRows(snap.excelImportQuoteRows);
      setDxfMethodGeometries(snap.dxfMethodGeometries);
      setBendPlateQuoteItems(snap.bendPlateQuoteItems);
      setStep(snap.step);
      setHighestStepReached(snap.highestStepReached);
      setPhase2Mode(snap.phase2Mode);
      setBendBuilderKey((k) => k + 1);
    }
    hydratedUrlRef.current = urlId;
  }, [urlId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (!urlId || urlId !== projectId) return;
      savePlateProjectSnapshot(projectId, {
        jobDetails,
        materialType,
        manualQuoteRows,
        excelImportQuoteRows,
        dxfMethodGeometries,
        bendPlateQuoteItems,
        step,
        highestStepReached,
        phase2Mode,
      });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [
    urlId,
    projectId,
    jobDetails,
    materialType,
    manualQuoteRows,
    excelImportQuoteRows,
    dxfMethodGeometries,
    bendPlateQuoteItems,
    step,
    highestStepReached,
    phase2Mode,
  ]);

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

  const mergedQuotePartsList = useMemo(
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

  useEffect(() => {
    if (!projectSavedToList) return;
    if (step < 2) return;
    const js = jobSummaryFromParts(mergedQuotePartsList);
    patchPlateProjectListRecord(projectId, {
      customerName: jobDetails.customerName.trim(),
      referenceNumber: jobDetails.referenceNumber.trim(),
      projectName: jobDetails.projectName.trim(),
      materialType,
      currentStep: step,
      totalWeightKg: js.totalEstWeightKg,
      totalAreaM2: js.totalPlateAreaM2,
    });
  }, [
    projectSavedToList,
    projectId,
    step,
    mergedQuotePartsList,
    jobDetails.customerName,
    jobDetails.referenceNumber,
    jobDetails.projectName,
    materialType,
  ]);

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
        if (s === 2) {
          setPhase2Mode("drawingPicker");
          setBendInitialTemplate(null);
        }
      }
    },
    [highestStepReached]
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

  const handleRemoveMergedPart = useCallback((row: QuotePartRow) => {
    const ids = new Set(row.lineSourceIds?.length ? row.lineSourceIds : [row.id]);
    setDxfMethodGeometries((prev) => prev.filter((g) => !ids.has(g.id)));
    setExcelImportQuoteRows((prev) => prev.filter((r) => !ids.has(r.id)));
    setManualQuoteRows((prev) => prev.filter((r) => !ids.has(r.id)));
    setBendPlateQuoteItems((prev) => prev.filter((item) => !ids.has(item.id)));
  }, []);

  const handleResetMergedLines = useCallback(() => {
    setBendPlateQuoteItems([]);
    setManualQuoteRows([]);
    setExcelImportQuoteRows([]);
    setDxfMethodGeometries([]);
    setPhase2Mode("drawingPicker");
    setBendInitialTemplate(null);
    setBendBuilderKey((k) => k + 1);
    advanceTo(2);
  }, [advanceTo]);

  const handleContinueFromDrawingPickerToSummary = useCallback(() => {
    if (mergedQuotePartsList.length === 0) return;
    advanceTo(3);
  }, [advanceTo, mergedQuotePartsList.length]);

  const handleContinueFromGeneral = useCallback(() => {
    setPhase2Mode("drawingPicker");
    setBendInitialTemplate(null);
    advanceTo(2);
  }, [advanceTo]);

  const handleSaveProjectToList = useCallback(() => {
    const js = jobSummaryFromParts(mergedQuotePartsList);
    upsertPlateProjectInProgress({
      id: projectId,
      referenceNumber: jobDetails.referenceNumber.trim(),
      customerName: jobDetails.customerName.trim(),
      projectName: jobDetails.projectName.trim(),
      materialType,
      currentStep: 3,
      totalWeightKg: js.totalEstWeightKg,
      totalAreaM2: js.totalPlateAreaM2,
    });
    setProjectSavedToList(true);
  }, [
    mergedQuotePartsList,
    projectId,
    jobDetails.referenceNumber,
    jobDetails.customerName,
    jobDetails.projectName,
    materialType,
  ]);

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
          showContinue: true,
          canContinue: mergedQuotePartsList.length > 0,
          onBack: handleBackFromCreatePlansPicker,
          onContinue: handleContinueFromDrawingPickerToSummary,
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
    mergedQuotePartsList.length,
    handleContinueFromDrawingPickerToSummary,
  ]);

  const shouldWarnOnLeave = step > 1 && !projectSavedToList;

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
      /* File downloads use <a download href="blob:…"> — same-origin as app; must not open leave dialog. */
      if (href.startsWith("blob:") || a.hasAttribute("download")) return;
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

  const wizardFullBleed = step === 2 || step === 3;

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
            wizardFullBleed
              ? cn(
                  "flex flex-col p-0 lg:p-0",
                  (step === 3 || step === 2) && "overflow-hidden"
                )
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
                onLeaveEditorToParent={closeBendWorkspaceToPicker}
              />
            </div>
          )}

          {step === 3 && (
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
              <MergedQuoteLinesStep
                parts={mergedQuotePartsList}
                currency={jobDetails.currency}
                dxfMethodGeometries={dxfMethodGeometries}
                onDeletePart={handleRemoveMergedPart}
                onReset={handleResetMergedLines}
                canReset={hasPhase2Data}
                headerTitle={t("plateProject.summaryPhase.title")}
                headerSubtitle={t("plateProject.summaryPhase.subtitle")}
                materialType={materialType}
                bendPlateQuoteItems={bendPlateQuoteItems}
                referenceNumber={jobDetails.referenceNumber}
                customerName={jobDetails.customerName}
              />
            </div>
          )}
        </PageContainer>
        <PlateProjectBottomBar
          currentStep={step}
          showBack={stepNav.showBack ?? false}
          showContinue={stepNav.showContinue ?? false}
          canContinue={stepNav.canContinue ?? false}
          onBack={stepNav.onBack}
          onContinue={stepNav.onContinue}
          saveProjectToList={
            step === 3
              ? {
                  label: t("plateProject.saveNewProject"),
                  savedLabel: t("plateProject.savedToProjectsList"),
                  saved: projectSavedToList,
                  canSave: mergedQuotePartsList.length > 0,
                  onClick: handleSaveProjectToList,
                }
              : undefined
          }
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
