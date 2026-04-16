"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { GeneralSection } from "./GeneralSection";
import { MethodDetailsRouter } from "./MethodDetailsRouter";
import { MergedQuoteLinesStep } from "./MergedQuoteLinesStep";
import { QuoteMethodPickerPhase } from "./QuoteMethodPickerPhase";
import { QuoteStepper } from "./QuoteStepper";
import { QuickQuoteBottomBar } from "./QuickQuoteBottomBar";
import { QuoteFinalizeExportStep } from "./QuoteFinalizeExportStep";
import { PricingStep } from "./PricingStep";
import { QuoteSummaryStep } from "./QuoteSummaryStep";
import { StockPricingStep } from "./StockPricingStep";
import type {
  DxfMethodExcelSnapshot,
  ManualQuotePartRow,
  QuickQuoteJobDetails,
  QuickQuoteStep,
  QuoteCreationMethod,
  QuotePartRow,
  QuoteSheetStockLine,
  ThicknessStockInput,
} from "../types/quickQuote";
import {
  MOCK_VALIDATION_ROWS,
} from "../mock/quickQuoteMockData";
import {
  buildSelectionBundle,
  buildSelectionBundleFromParts,
  isThicknessStockComplete,
  mergeDefaultStockRows,
} from "../lib/deriveQuoteSelection";
import { dxfMethodHasQuotableParts } from "../lib/dxfQuoteParts";
import { mergeAllQuoteMethodParts } from "../lib/mergeAllQuoteMethods";
import type { BendPlateQuoteItem } from "../bend-plate/types";
import { generateQuoteReference } from "../lib/generateQuoteReference";
import { MOCK_MFG_PARAMETERS } from "../mock/quickQuoteMockData";
import type { QuotePdfFullPayload } from "../lib/quotePdfPayload";
import {
  buildQuotePdfFullPayload,
  computeTotalInclVatFromQuoteParts,
} from "../lib/quotePdfPayload";
import type { DxfPartGeometry } from "@/types";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/types/materials";
import { getPurchasedSheetSizes } from "@/lib/store";
import {
  markQuoteComplete,
  patchQuoteSession,
  upsertQuoteInProgress,
} from "@/lib/quotes/quoteList";
import { saveQuoteSnapshot } from "@/lib/quotes/quoteSnapshot";
import { nanoid } from "@/lib/utils/nanoid";
import { t } from "@/lib/i18n";

const defaultJobDetails: QuickQuoteJobDetails = {
  referenceNumber: "",
  projectName: "",
  customerName: "",
  currency: "EUR",
  notes: "",
};

type QuoteMethodSubView = "picker" | "methodSetup";

export function QuickQuotePage() {
  const router = useRouter();
  /** Stable id for this browser session — ties wizard progress to the Quotes list. */
  const quoteListSessionIdRef = useRef<string | null>(null);
  /** After user clicks "Save to list" on step 7, the quote exists in the quotes list; until then, no list row. */
  const [quoteSavedToList, setQuoteSavedToList] = useState(false);
  const [leaveWizardDialogOpen, setLeaveWizardDialogOpen] = useState(false);
  /** Target path for in-app navigation after user confirms leaving. */
  const pendingNavigationHrefRef = useRef<string | null>(null);
  const [step, setStep] = useState<QuickQuoteStep>(1);
  const [highestStepReached, setHighestStepReached] = useState<QuickQuoteStep>(1);
  const [quoteMethodSubView, setQuoteMethodSubView] =
    useState<QuoteMethodSubView>("picker");

  /** Scroll both the app shell and the page `<main>` so the step header stays visible after step changes. */
  const pageMainScrollRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const shell = document.getElementById("app-shell-scroll");
    if (shell) shell.scrollTop = 0;
    const main = pageMainScrollRef.current;
    if (main) main.scrollTop = 0;
  }, [step, quoteMethodSubView]);
  const [jobDetails, setJobDetails] = useState<QuickQuoteJobDetails>(() => ({
    ...defaultJobDetails,
    referenceNumber: generateQuoteReference(),
  }));
  const [materialType, setMaterialType] = useState<MaterialType>("carbonSteel");
  const [thicknessStock, setThicknessStock] = useState<ThicknessStockInput[]>([]);
  const [materialPricePerKg, setMaterialPricePerKg] = useState(
    () => MOCK_MFG_PARAMETERS.materialRatePerKg
  );
  /** Pricing phase: per-kg sell prices keyed like {@link materialPricingRowKey}. */
  const [materialPricePerKgByRow, setMaterialPricePerKgByRow] = useState<
    Record<string, string>
  >({});
  const [pdfExportDraft, setPdfExportDraft] = useState<QuotePdfFullPayload | null>(null);
  const stableSetFinalizeDraft = useCallback(
    (action: React.SetStateAction<QuotePdfFullPayload>) => {
      setPdfExportDraft((prev) => {
        if (prev === null) return prev;
        return typeof action === "function" ? action(prev) : action;
      });
    },
    []
  );
  const [manualQuoteRows, setManualQuoteRows] = useState<ManualQuotePartRow[]>([]);

  /** Plates from the Import Excel list method only (separate from manual rows). */
  const [excelImportQuoteRows, setExcelImportQuoteRows] = useState<ManualQuotePartRow[]>(
    []
  );

  const [bendPlateQuoteItems, setBendPlateQuoteItems] = useState<BendPlateQuoteItem[]>([]);

  /** DXF-only quote method: geometries approved in method step. */
  const [dxfMethodGeometries, setDxfMethodGeometries] = useState<DxfPartGeometry[]>([]);
  /** Optional Excel BOM for DXF method — kept with geometries for session restore after Complete. */
  const [dxfMethodExcel, setDxfMethodExcel] = useState<DxfMethodExcelSnapshot | null>(null);

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

  const advanceTo = useCallback((s: QuickQuoteStep) => {
    setStep(s);
    setHighestStepReached((h) => (s > h ? s : h));
    if (s === 2) setQuoteMethodSubView("picker");
  }, []);

  const goToStep = useCallback(
    (s: QuickQuoteStep) => {
      if (s <= highestStepReached) {
        setStep(s);
        if (s === 2) setQuoteMethodSubView("picker");
      }
    },
    [highestStepReached]
  );

  const stockPricingReady = useMemo(() => {
    if (thicknessStock.length === 0) return false;
    return isThicknessStockComplete(thicknessStock);
  }, [thicknessStock]);

  const selection = useMemo(() => {
    const modernParts = mergeAllQuoteMethodParts(
      materialType,
      manualQuoteRows,
      excelImportQuoteRows,
      dxfMethodGeometries,
      bendPlateQuoteItems
    );
    if (modernParts.length > 0) {
      const stock = stockPricingReady ? thicknessStock : null;
      return buildSelectionBundleFromParts(
        modernParts,
        stock,
        stock ? materialPricePerKg : undefined
      );
    }
    const stock = stockPricingReady ? thicknessStock : null;
    return buildSelectionBundle(
      MOCK_VALIDATION_ROWS,
      stock,
      stock ? materialPricePerKg : undefined
    );
  }, [
    bendPlateQuoteItems,
    manualQuoteRows,
    excelImportQuoteRows,
    dxfMethodGeometries,
    materialType,
    thicknessStock,
    materialPricePerKg,
    stockPricingReady,
  ]);

  const clearAllQuoteMethodData = useCallback(() => {
    setManualQuoteRows([]);
    setExcelImportQuoteRows([]);
    setBendPlateQuoteItems([]);
    setDxfMethodGeometries([]);
    setDxfMethodExcel(null);
    setJobDetails((j) => ({ ...j, quoteCreationMethod: undefined }));
  }, []);

  const handleContinueFromGeneral = () => {
    if (!quoteListSessionIdRef.current) {
      quoteListSessionIdRef.current = nanoid();
    }
    /** List row is created only on explicit Save in phase 7 ({@link handleSaveQuoteToList}). */
    advanceTo(2);
  };

  const handleBackFromQuoteMethod = () => {
    advanceTo(1);
  };

  const handleCompleteQuoteMethodPicker = useCallback(() => {
    const parts = mergeAllQuoteMethodParts(
      materialType,
      manualQuoteRows,
      excelImportQuoteRows,
      dxfMethodGeometries,
      bendPlateQuoteItems
    );
    if (parts.length === 0) return;
    advanceTo(3);
  }, [
    materialType,
    manualQuoteRows,
    excelImportQuoteRows,
    dxfMethodGeometries,
    bendPlateQuoteItems,
    advanceTo,
  ]);

  const handleConfigureMethodFromPicker = useCallback(
    (method: QuoteCreationMethod) => {
      setJobDetails((j) => ({ ...j, quoteCreationMethod: method }));
      setQuoteMethodSubView("methodSetup");
    },
    []
  );

  const handleBackFromMergedLines = useCallback(() => {
    advanceTo(2);
  }, [advanceTo]);

  const handleContinueFromMergedLines = useCallback(() => {
    const parts = mergeAllQuoteMethodParts(
      materialType,
      manualQuoteRows,
      excelImportQuoteRows,
      dxfMethodGeometries,
      bendPlateQuoteItems
    );
    if (parts.length === 0) return;
    setThicknessStock((prev) =>
      mergeDefaultStockRows(parts, prev, materialType, getPurchasedSheetSizes())
    );
    advanceTo(4);
  }, [
    materialType,
    manualQuoteRows,
    excelImportQuoteRows,
    dxfMethodGeometries,
    bendPlateQuoteItems,
    advanceTo,
  ]);

  const handleResetMergedLines = useCallback(() => {
    clearAllQuoteMethodData();
    advanceTo(2);
  }, [clearAllQuoteMethodData, advanceTo]);

  const handleRemoveMergedPart = useCallback((row: QuotePartRow) => {
    const ids = new Set(row.lineSourceIds?.length ? row.lineSourceIds : [row.id]);
    setDxfMethodGeometries((prev) => prev.filter((g) => !ids.has(g.id)));
    setExcelImportQuoteRows((prev) => prev.filter((r) => !ids.has(r.id)));
    setManualQuoteRows((prev) => prev.filter((r) => !ids.has(r.id)));
    setBendPlateQuoteItems((prev) => prev.filter((item) => !ids.has(item.id)));
  }, []);

  /** Complete / Back inside a method phase — return to Quote method picker (still step 2). */
  const handleReturnToQuoteMethodFromMethodSetup = useCallback(() => {
    setQuoteMethodSubView("picker");
  }, []);

  const handleBackFromStockToValidation = useCallback(() => {
    advanceTo(3);
  }, [advanceTo]);

  const handleContinueFromStockToQuantityAnalysis = () => {
    advanceTo(5);
  };

  const handleContinueFromQuoteToPricing = useCallback(() => {
    advanceTo(6);
  }, [advanceTo]);
  const handleBackFromQuote = () => advanceTo(4);
  const handleBackFromPricing = useCallback(() => {
    advanceTo(5);
  }, [advanceTo]);
  const buildFinalizeDraft = useCallback(
    (): QuotePdfFullPayload =>
      buildQuotePdfFullPayload(
        jobDetails,
        selection.jobSummary,
        selection.parts,
        selection.mfgParams,
        selection.pricing,
        materialType,
        materialPricePerKgByRow
      ),
    [jobDetails, selection, materialType, materialPricePerKgByRow]
  );

  const handleContinueToFinalize = useCallback(() => {
    setPdfExportDraft(buildFinalizeDraft());
    advanceTo(7);
  }, [advanceTo, buildFinalizeDraft]);

  const handleSaveQuoteToList = useCallback(() => {
    let qid = quoteListSessionIdRef.current;
    if (!qid) {
      qid = nanoid();
      quoteListSessionIdRef.current = qid;
    }
    const js = selection.jobSummary;
    const draftIncl = pdfExportDraft?.pricing?.total_incl_vat;
    const totalInclVat =
      pdfExportDraft != null &&
      typeof draftIncl === "number" &&
      Number.isFinite(draftIncl)
        ? draftIncl
        : computeTotalInclVatFromQuoteParts(
            selection.parts,
            materialType,
            materialPricePerKgByRow
          );
    upsertQuoteInProgress({
      id: qid,
      referenceNumber: jobDetails.referenceNumber,
      customerName: jobDetails.customerName.trim(),
      projectName: jobDetails.projectName.trim(),
      customerClientId: jobDetails.customerClientId,
      currentStep: 7,
    });
    patchQuoteSession(qid, {
      currentStep: 7,
      customerClientId: jobDetails.customerClientId,
      projectName: jobDetails.projectName.trim(),
      customerName: jobDetails.customerName.trim(),
      referenceNumber: jobDetails.referenceNumber,
      totalWeightKg: js.totalEstWeightKg,
      totalAreaM2: js.totalPlateAreaM2,
      totalItemQty: js.totalQty,
      totalInclVat,
    });
    markQuoteComplete(qid);
    setQuoteSavedToList(true);
  }, [
    jobDetails.referenceNumber,
    jobDetails.customerName,
    jobDetails.projectName,
    jobDetails.customerClientId,
    selection.jobSummary,
    selection.parts,
    materialType,
    materialPricePerKgByRow,
    pdfExportDraft,
  ]);

  const handleBackFromFinalize = useCallback(() => {
    advanceTo(6);
  }, [advanceTo]);

  useEffect(() => {
    if (step === 7 && pdfExportDraft === null) {
      setPdfExportDraft(buildFinalizeDraft());
    }
  }, [step, pdfExportDraft, buildFinalizeDraft]);

  useEffect(() => {
    if (!quoteSavedToList) return;
    const qid = quoteListSessionIdRef.current;
    if (!qid) return;
    const js = selection.jobSummary;
    const draftIncl = pdfExportDraft?.pricing?.total_incl_vat;
    const totalInclVat =
      pdfExportDraft != null &&
      typeof draftIncl === "number" &&
      Number.isFinite(draftIncl)
        ? draftIncl
        : computeTotalInclVatFromQuoteParts(
            selection.parts,
            materialType,
            materialPricePerKgByRow
          );
    patchQuoteSession(qid, {
      currentStep: step,
      customerClientId: jobDetails.customerClientId,
      projectName: jobDetails.projectName.trim(),
      customerName: jobDetails.customerName.trim(),
      referenceNumber: jobDetails.referenceNumber,
      totalWeightKg: js.totalEstWeightKg,
      totalAreaM2: js.totalPlateAreaM2,
      totalItemQty: js.totalQty,
      totalInclVat,
    });
  }, [
    quoteSavedToList,
    step,
    jobDetails.customerClientId,
    jobDetails.projectName,
    jobDetails.customerName,
    jobDetails.referenceNumber,
    selection.jobSummary.totalEstWeightKg,
    selection.jobSummary.totalPlateAreaM2,
    selection.jobSummary.totalQty,
    selection.parts,
    materialType,
    materialPricePerKgByRow,
    pdfExportDraft,
  ]);

  const setSheetsForThickness = useCallback(
    (thicknessMm: number, sheets: QuoteSheetStockLine[]) => {
      setThicknessStock((rows) =>
        rows.map((r) =>
          r.thicknessMm === thicknessMm ? { ...r, sheets } : r
        )
      );
    },
    []
  );

  const canContinueFromGeneral = useMemo(() => {
    return (
      jobDetails.projectName.trim().length > 0 &&
      jobDetails.customerName.trim().length > 0
    );
  }, [jobDetails.projectName, jobDetails.customerName]);

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

  /** Persist a read-only snapshot for `/quotes/[id]/preview` (debounced). */
  useEffect(() => {
    const qid = quoteListSessionIdRef.current;
    if (!qid || mergedQuotePartsList.length === 0) return;
    let draftPayload: QuotePdfFullPayload;
    try {
      draftPayload = pdfExportDraft ?? buildFinalizeDraft();
    } catch {
      return;
    }
    const tmr = window.setTimeout(() => {
      saveQuoteSnapshot(qid, {
        draft: draftPayload,
        materialType,
        materialPricePerKgByRow,
        mergedParts: mergedQuotePartsList,
        dxfMethodGeometries,
        bendPlateQuoteItems,
        generalNotes: jobDetails.notes?.trim() ?? "",
      });
    }, 500);
    return () => window.clearTimeout(tmr);
  }, [
    mergedQuotePartsList,
    materialType,
    materialPricePerKgByRow,
    dxfMethodGeometries,
    bendPlateQuoteItems,
    jobDetails.notes,
    pdfExportDraft,
    buildFinalizeDraft,
  ]);

  const hasAnyQuoteMethodData = mergedQuotePartsList.length > 0;

  const getStepNavigation = useCallback(() => {
    switch (step) {
      case 1:
        return {
          showBack: false,
          showContinue: true,
          canContinue: canContinueFromGeneral,
          onContinue: handleContinueFromGeneral,
        };
      case 2:
        if (quoteMethodSubView === "picker") {
          return {
            showBack: true,
            showContinue: true,
            canContinue: hasAnyQuoteMethodData,
            onBack: handleBackFromQuoteMethod,
            onContinue: handleCompleteQuoteMethodPicker,
          };
        }
        return {
          showBack: false,
          showContinue: false,
          canContinue: false,
        };
      case 3:
        return {
          showBack: true,
          showContinue: true,
          canContinue: hasAnyQuoteMethodData,
          onBack: handleBackFromMergedLines,
          onContinue: handleContinueFromMergedLines,
        };
      case 4:
        return {
          showBack: true,
          showContinue: true,
          canContinue: stockPricingReady,
          onBack: handleBackFromStockToValidation,
          onContinue: handleContinueFromStockToQuantityAnalysis,
        };
      case 5:
        return {
          showBack: true,
          showContinue: true,
          canContinue: selection.parts.length > 0,
          onBack: handleBackFromQuote,
          onContinue: handleContinueFromQuoteToPricing,
        };
      case 6:
        return {
          showBack: true,
          showContinue: true,
          canContinue: true,
          onBack: handleBackFromPricing,
          onContinue: handleContinueToFinalize,
        };
      case 7:
        return {
          showBack: true,
          showContinue: false,
          canContinue: false,
          onBack: handleBackFromFinalize,
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
    quoteMethodSubView,
    hasAnyQuoteMethodData,
    stockPricingReady,
    canContinueFromGeneral,
    handleContinueFromGeneral,
    handleBackFromQuoteMethod,
    handleCompleteQuoteMethodPicker,
    handleBackFromMergedLines,
    handleContinueFromMergedLines,
    handleBackFromStockToValidation,
    handleContinueFromStockToQuantityAnalysis,
    handleBackFromQuote,
    handleContinueFromQuoteToPricing,
    handleBackFromPricing,
    handleContinueToFinalize,
    handleBackFromFinalize,
    selection.parts.length,
  ]);

  const stepNav = getStepNavigation();

  const shouldWarnOnLeave = step > 1 && !quoteSavedToList;

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
        if (u.pathname === "/quick-quote" || u.pathname.startsWith("/quick-quote/")) {
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

  const methodSetupScrollFriendly =
    step === 2 && quoteMethodSubView === "methodSetup";

  return (
    <div
      dir="rtl"
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        !methodSetupScrollFriendly && "overflow-hidden"
      )}
    >
      <QuoteStepper
        currentStep={step}
        highestStepReached={highestStepReached}
        onStepSelect={goToStep}
      />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          !methodSetupScrollFriendly && "overflow-hidden"
        )}
      >
        <PageContainer
          ref={pageMainScrollRef}
          className={cn(
            "bg-background min-h-0 flex-1",
            step === 2 || step === 3
              ? cn(
                  "flex flex-col p-0 lg:p-0",
                  (step === 3 ||
                    (step === 2 && quoteMethodSubView === "picker")) &&
                    "overflow-hidden"
                )
              : cn(
                  "overflow-y-auto",
                  /* Finalize: drop main top padding so sticky table thead can sit flush under the stepper (p-6 top was leaving a ~24px strip). */
                  step === 7 && "!pt-0"
                )
          )}
        >
        <div
          className={cn(
            "w-full",
            step === 2 || step === 3
              ? cn(
                  "flex min-h-0 flex-1 flex-col",
                  (step === 3 ||
                    (step === 2 && quoteMethodSubView === "picker")) &&
                    "overflow-hidden"
                )
              : "space-y-8"
          )}
        >
          {step === 1 && (
            <Card className="mx-auto w-full max-w-xl border-0 shadow-sm">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-xl tracking-tight">
                  {t("quickQuotePage.generalTitle")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("quickQuotePage.generalSubtitle")}
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

          {step === 2 && quoteMethodSubView === "picker" && (
            <QuoteMethodPickerPhase
              materialType={materialType}
              manualQuoteRows={manualQuoteRows}
              excelImportQuoteRows={excelImportQuoteRows}
              dxfMethodGeometries={dxfMethodGeometries}
              bendPlateQuoteItems={bendPlateQuoteItems}
              selected={jobDetails.quoteCreationMethod ?? null}
              onSelect={(method) => {
                setJobDetails((j) => ({ ...j, quoteCreationMethod: method }));
              }}
              onConfigureMethod={handleConfigureMethodFromPicker}
            />
          )}

          {step === 2 && quoteMethodSubView === "methodSetup" && (
            <MethodDetailsRouter
              method={jobDetails.quoteCreationMethod ?? null}
              onBackToMethodPicker={handleReturnToQuoteMethodFromMethodSetup}
              materialType={materialType}
              manualQuoteRows={manualQuoteRows}
              onManualQuoteRowsChange={setManualQuoteRows}
              onExcelImportQuoteRowsChange={setExcelImportQuoteRows}
              excelImportQuoteRows={excelImportQuoteRows}
              bendPlateQuoteItems={bendPlateQuoteItems}
              onBendPlateAddItem={handleBendPlateAddItem}
              onBendPlateUpdateItem={handleBendPlateUpdateItem}
              onBendPlateRemoveItem={handleBendPlateRemoveItem}
              onBendPlateResetAll={handleBendPlateResetAll}
              onDxfMethodGeometriesChange={setDxfMethodGeometries}
              dxfMethodGeometries={dxfMethodGeometries}
              dxfMethodExcel={dxfMethodExcel}
              onDxfMethodExcelChange={setDxfMethodExcel}
              dxfExcelExportProjectName={jobDetails.projectName.trim()}
            />
          )}

          {step === 3 && (
            <MergedQuoteLinesStep
              parts={mergedQuotePartsList}
              currency={jobDetails.currency}
              dxfMethodGeometries={dxfMethodGeometries}
              onDeletePart={handleRemoveMergedPart}
              onReset={handleResetMergedLines}
              canReset={hasAnyQuoteMethodData}
            />
          )}

          {step === 4 && (
            <StockPricingStep
              stockRows={thicknessStock}
              parts={mergedQuotePartsList}
              materialType={materialType}
              onSheetsChange={setSheetsForThickness}
            />
          )}

          {step === 5 && (
            <QuoteSummaryStep
              jobDetails={jobDetails}
              jobSummary={selection.jobSummary}
              parts={selection.parts}
              mfgParams={selection.mfgParams}
              thicknessStock={
                thicknessStock.length > 0 ? thicknessStock : undefined
              }
            />
          )}

          {step === 6 && (
            <PricingStep
              parts={selection.parts}
              materialType={materialType}
              currencyCode={jobDetails.currency}
              pricePerKgByRow={materialPricePerKgByRow}
              onPricePerKgByRowChange={setMaterialPricePerKgByRow}
              dxfPartGeometries={dxfMethodGeometries}
            />
          )}

          {step === 7 && pdfExportDraft && (
            <QuoteFinalizeExportStep
              draft={pdfExportDraft}
              setDraft={stableSetFinalizeDraft}
              materialFamilyLabel={MATERIAL_TYPE_LABELS[materialType]}
              materialType={materialType}
              materialPricePerKgByRow={materialPricePerKgByRow}
              quotePartsForPreview={selection.parts}
              dxfPartGeometries={dxfMethodGeometries}
            />
          )}
        </div>
      </PageContainer>
        <QuickQuoteBottomBar
          currentStep={step}
          showBack={stepNav.showBack ?? false}
          showContinue={stepNav.showContinue ?? false}
          canContinue={stepNav.canContinue ?? false}
          onBack={stepNav.onBack}
          onContinue={stepNav.onContinue}
          saveQuoteToList={
            step === 7
              ? {
                  label: t("quickQuotePage.saveQuoteToList"),
                  savedLabel: t("quickQuotePage.savedToListShort"),
                  onClick: handleSaveQuoteToList,
                  disabled: quoteSavedToList,
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
            <DialogTitle>{t("quickQuotePage.leaveWizardTitle")}</DialogTitle>
            <DialogDescription className="text-start text-sm leading-relaxed">
              {t("quickQuotePage.leaveWizardConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row flex-wrap gap-2">
            <Button type="button" variant="destructive" onClick={handleLeaveWizardConfirm}>
              {t("quickQuotePage.leaveWizardLeave")}
            </Button>
            <Button type="button" variant="outline" onClick={handleLeaveWizardStay}>
              {t("quickQuotePage.leaveWizardStay")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
