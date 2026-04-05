"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GeneralSection } from "./GeneralSection";
import { MethodDetailsRouter } from "./MethodDetailsRouter";
import { MergedQuoteLinesStep } from "./MergedQuoteLinesStep";
import { QuoteMethodPickerPhase } from "./QuoteMethodPickerPhase";
import { CalculationStep } from "./CalculationStep";
import { QuoteStepper } from "./QuoteStepper";
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
import { buildQuotePdfFullPayload } from "../lib/quotePdfPayload";
import type { DxfPartGeometry } from "@/types";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/types/materials";
import { getPurchasedSheetSizes } from "@/lib/store";
import {
  markQuoteComplete,
  patchQuoteSession,
  upsertQuoteInProgress,
} from "@/lib/quotes/quoteList";
import { nanoid } from "@/lib/utils/nanoid";

const defaultJobDetails: QuickQuoteJobDetails = {
  referenceNumber: "",
  projectName: "",
  customerName: "",
  currency: "EUR",
  notes: "",
};

type QuoteMethodSubView = "picker" | "methodSetup";

export function QuickQuotePage() {
  /** Stable id for this browser session — ties wizard progress to the Quotes list. */
  const quoteListSessionIdRef = useRef<string | null>(null);
  const [step, setStep] = useState<QuickQuoteStep>(1);
  const [highestStepReached, setHighestStepReached] = useState<QuickQuoteStep>(1);
  const [quoteMethodSubView, setQuoteMethodSubView] =
    useState<QuoteMethodSubView>("picker");
  const [jobDetails, setJobDetails] = useState<QuickQuoteJobDetails>(() => ({
    ...defaultJobDetails,
    referenceNumber: generateQuoteReference(),
  }));
  const [materialType, setMaterialType] = useState<MaterialType>("carbonSteel");
  const [calcRunId, setCalcRunId] = useState(0);
  const [thicknessStock, setThicknessStock] = useState<ThicknessStockInput[]>([]);
  const [materialPricePerKg, setMaterialPricePerKg] = useState(
    () => MOCK_MFG_PARAMETERS.materialRatePerKg
  );
  /** Pricing phase: per-kg sell prices keyed like {@link materialPricingRowKey}. */
  const [materialPricePerKgByRow, setMaterialPricePerKgByRow] = useState<
    Record<string, string>
  >({});
  const [pdfExportDraft, setPdfExportDraft] = useState<QuotePdfFullPayload | null>(null);

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
    const priceOk =
      materialPricePerKg >= 0 && Number.isFinite(materialPricePerKg);
    return priceOk && isThicknessStockComplete(thicknessStock);
  }, [thicknessStock, materialPricePerKg]);

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
    upsertQuoteInProgress({
      id: quoteListSessionIdRef.current,
      referenceNumber: jobDetails.referenceNumber,
      customerName: jobDetails.customerName.trim(),
      currentStep: 2,
    });
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

  const handleResetQuoteMethodPicker = useCallback(() => {
    clearAllQuoteMethodData();
  }, [clearAllQuoteMethodData]);

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

  const handleContinueFromStockToCalculation = () => {
    setCalcRunId((id) => id + 1);
    advanceTo(5);
  };

  const handleBackFromCalculationToStock = () => advanceTo(4);
  const handleViewQuote = () => advanceTo(6);
  const handleContinueFromQuoteToPricing = useCallback(() => {
    advanceTo(7);
  }, [advanceTo]);
  const handleBackFromQuote = () => advanceTo(5);
  const handleBackFromPricing = useCallback(() => {
    advanceTo(6);
  }, [advanceTo]);
  const handleBackToValidationFromQuote = useCallback(() => {
    advanceTo(3);
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
    const qid = quoteListSessionIdRef.current;
    if (qid) {
      markQuoteComplete(qid);
    }
    advanceTo(8);
  }, [advanceTo, buildFinalizeDraft]);

  const handleBackFromFinalize = useCallback(() => {
    advanceTo(7);
  }, [advanceTo]);

  useEffect(() => {
    if (step === 8 && pdfExportDraft === null) {
      setPdfExportDraft(buildFinalizeDraft());
    }
  }, [step, pdfExportDraft, buildFinalizeDraft]);

  useEffect(() => {
    const qid = quoteListSessionIdRef.current;
    if (!qid || step <= 1) return;
    patchQuoteSession(qid, { currentStep: step });
  }, [step]);

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
        return {
          showBack: false,
          showContinue: false,
          canContinue: false,
        };
      case 3:
        return {
          showBack: false,
          showContinue: false,
          canContinue: false,
        };
      case 4:
        return {
          showBack: true,
          showContinue: true,
          canContinue: stockPricingReady,
          onBack: handleBackFromStockToValidation,
          onContinue: handleContinueFromStockToCalculation,
        };
      case 5:
        return {
          showBack: true,
          showContinue: true,
          canContinue: true,
          onBack: handleBackFromCalculationToStock,
          onContinue: handleViewQuote,
        };
      case 6:
        return {
          showBack: true,
          showContinue: true,
          canContinue: true,
          onBack: handleBackFromQuote,
          onContinue: handleContinueFromQuoteToPricing,
        };
      case 7:
        return {
          showBack: true,
          showContinue: true,
          canContinue: true,
          onBack: handleBackFromPricing,
          onContinue: handleContinueToFinalize,
        };
      case 8:
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
    stockPricingReady,
    canContinueFromGeneral,
    handleContinueFromGeneral,
    handleBackFromStockToValidation,
    handleContinueFromStockToCalculation,
    handleBackFromCalculationToStock,
    handleViewQuote,
    handleBackFromQuote,
    handleContinueFromQuoteToPricing,
    handleBackFromPricing,
    handleContinueToFinalize,
    handleBackFromFinalize,
  ]);

  const stepNav = getStepNavigation();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <QuoteStepper
        currentStep={step}
        highestStepReached={highestStepReached}
        onStepSelect={goToStep}
        {...stepNav}
      />
      <PageContainer
        className={cn(
          "bg-background flex-1 min-h-0",
          step === 2 || step === 3
            ? "flex flex-col overflow-hidden p-0 lg:p-0"
            : "overflow-y-auto"
        )}
      >
        <div
          className={cn(
            "w-full",
            step === 2 || step === 3
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "space-y-8"
          )}
        >
          {step === 1 && (
            <Card className="mx-auto w-full max-w-4xl border border-white/[0.06] shadow-sm">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-xl tracking-tight">General</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Quote details and client information. Fields marked{" "}
                  <span className="text-destructive">*</span> are required to continue.
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
              onBack={handleBackFromQuoteMethod}
              onReset={handleResetQuoteMethodPicker}
              onComplete={handleCompleteQuoteMethodPicker}
              canComplete={hasAnyQuoteMethodData}
              canReset={hasAnyQuoteMethodData}
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
              onDxfMethodGeometriesChange={setDxfMethodGeometries}
              dxfMethodGeometries={dxfMethodGeometries}
              dxfMethodExcel={dxfMethodExcel}
              onDxfMethodExcelChange={setDxfMethodExcel}
            />
          )}

          {step === 3 && (
            <MergedQuoteLinesStep
              parts={mergedQuotePartsList}
              currency={jobDetails.currency}
              referenceNumber={jobDetails.referenceNumber}
              dxfMethodGeometries={dxfMethodGeometries}
              bendPlateQuoteItems={bendPlateQuoteItems}
              onDeletePart={handleRemoveMergedPart}
              onBack={handleBackFromMergedLines}
              onReset={handleResetMergedLines}
              onContinue={handleContinueFromMergedLines}
              canContinue={hasAnyQuoteMethodData}
              canReset={hasAnyQuoteMethodData}
            />
          )}

          {step === 4 && (
            <StockPricingStep
              stockRows={thicknessStock}
              materialType={materialType}
              currencyCode={jobDetails.currency}
              materialPricePerKg={materialPricePerKg}
              onMaterialPriceChange={setMaterialPricePerKg}
              onSheetsChange={setSheetsForThickness}
              onBack={handleBackFromStockToValidation}
              onContinue={handleContinueFromStockToCalculation}
            />
          )}

          {step === 5 && (
            <CalculationStep
              key={calcRunId}
              runId={calcRunId}
              jobDetails={jobDetails}
              dxfFileCount={dxfMethodGeometries.length}
              uniquePlatesInRun={selection.parts.length}
              totalPartsQty={selection.jobSummary.totalQty}
              validationSummary={selection.validationSummary}
              onBack={handleBackFromCalculationToStock}
              onViewQuote={handleViewQuote}
            />
          )}

          {step === 6 && (
            <QuoteSummaryStep
              jobDetails={jobDetails}
              jobSummary={selection.jobSummary}
              parts={selection.parts}
              mfgParams={selection.mfgParams}
              thicknessStock={
                thicknessStock.length > 0 ? thicknessStock : undefined
              }
              onBack={handleBackFromQuote}
              onBackToValidation={handleBackToValidationFromQuote}
              onContinueToPricing={handleContinueFromQuoteToPricing}
            />
          )}

          {step === 7 && (
            <PricingStep
              parts={selection.parts}
              materialType={materialType}
              currencyCode={jobDetails.currency}
              pricePerKgByRow={materialPricePerKgByRow}
              onPricePerKgByRowChange={setMaterialPricePerKgByRow}
              dxfPartGeometries={dxfMethodGeometries}
            />
          )}

          {step === 8 && pdfExportDraft && (
            <QuoteFinalizeExportStep
              draft={pdfExportDraft}
              setDraft={(action) => {
                setPdfExportDraft((prev) => {
                  if (prev === null) return prev;
                  return typeof action === "function" ? action(prev) : action;
                });
              }}
              materialFamilyLabel={MATERIAL_TYPE_LABELS[materialType]}
              materialType={materialType}
              materialPricePerKgByRow={materialPricePerKgByRow}
              onBack={handleBackFromFinalize}
            />
          )}
        </div>
      </PageContainer>
    </div>
  );
}
