"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GeneralSection } from "./GeneralSection";
import { MethodDetailsRouter } from "./MethodDetailsRouter";
import { MergedQuoteLinesStep } from "./MergedQuoteLinesStep";
import { QuoteMethodPickerPhase } from "./QuoteMethodPickerPhase";
import { ExcelUploadStep } from "./ExcelUploadStep";
import { DxfUploadStep } from "./DxfUploadStep";
import { CalculationStep } from "./CalculationStep";
import { QuoteStepper } from "./QuoteStepper";
import { QuoteFinalizeExportStep } from "./QuoteFinalizeExportStep";
import { QuoteSummaryStep } from "./QuoteSummaryStep";
import { StockPricingStep } from "./StockPricingStep";
import { UploadStep } from "./UploadStep";
import { ValidationStep } from "./ValidationStep";
import type {
  DxfMethodExcelSnapshot,
  ManualQuotePartRow,
  QuickQuoteJobDetails,
  QuickQuoteStep,
  QuoteCreationMethod,
  QuoteSheetStockLine,
  ThicknessStockInput,
  UploadedFileMeta,
  ValidationRow,
} from "../types/quickQuote";
import type { ExcelRow, DxfPartGeometry } from "@/types";
import type { ValidationSummary } from "../types/quickQuote";
import {
  MOCK_VALIDATION_ROWS,
  MOCK_VALIDATION_SUMMARY,
} from "../mock/quickQuoteMockData";
import {
  buildSelectionBundle,
  buildSelectionBundleFromParts,
  isThicknessStockComplete,
  mergeDefaultStockRows,
  quotePartsForValidationSelection,
} from "../lib/deriveQuoteSelection";
import { dxfMethodHasQuotableParts } from "../lib/dxfQuoteParts";
import { mergeAllQuoteMethodParts } from "../lib/mergeAllQuoteMethods";
import type { BendPlateQuoteItem } from "../bend-plate/types";
import { generateQuoteReference } from "../lib/generateQuoteReference";
import { MOCK_MFG_PARAMETERS } from "../mock/quickQuoteMockData";
import type { QuotePdfFullPayload } from "../lib/quotePdfPayload";
import { buildQuotePdfFullPayload } from "../lib/quotePdfPayload";
import type { MaterialType } from "@/types/materials";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { getPurchasedSheetSizes } from "@/lib/store";

const defaultJobDetails: QuickQuoteJobDetails = {
  referenceNumber: "",
  customerName: "",
  currency: "EUR",
  notes: "",
};

import { buildValidationData } from "../lib/buildValidationData";

export function QuickQuotePage() {
  const [step, setStep] = useState<QuickQuoteStep>(1);
  const [highestStepReached, setHighestStepReached] = useState<QuickQuoteStep>(1);
  const [dxfFiles, setDxfFiles] = useState<UploadedFileMeta[]>([]);
  const [excelFile, setExcelFile] = useState<UploadedFileMeta | null>(null);
  const [jobDetails, setJobDetails] = useState<QuickQuoteJobDetails>(() => ({
    ...defaultJobDetails,
    referenceNumber: generateQuoteReference(),
  }));
  const [materialType, setMaterialType] = useState<MaterialType>("carbonSteel");
  const [excelData, setExcelData] = useState<ExcelRow[] | null>(null);
  const [dxfData, setDxfData] = useState<DxfPartGeometry[] | null>(null);
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary>({
    totalRows: 0,
    matched: 0,
    warnings: 0,
    critical: 0,
  });
  const [calcRunId, setCalcRunId] = useState(0);
  const [calculationRows, setCalculationRows] = useState<ValidationRow[] | null>(
    null
  );
  const [thicknessStock, setThicknessStock] = useState<ThicknessStockInput[]>([]);
  const [materialPricePerKg, setMaterialPricePerKg] = useState(
    () => MOCK_MFG_PARAMETERS.materialRatePerKg
  );
  const [pdfExportDraft, setPdfExportDraft] = useState<QuotePdfFullPayload | null>(null);

  const [manualQuoteRows, setManualQuoteRows] = useState<ManualQuotePartRow[]>([]);

  /** Plates from the Import Excel list method only (separate from manual rows). */
  const [excelImportQuoteRows, setExcelImportQuoteRows] = useState<ManualQuotePartRow[]>(
    []
  );

  const [bendPlateQuoteItems, setBendPlateQuoteItems] = useState<BendPlateQuoteItem[]>([]);

  /** DXF-only quote method: geometries approved in method step (same flow as legacy step 5). */
  const [dxfMethodGeometries, setDxfMethodGeometries] = useState<DxfPartGeometry[]>([]);
  /** Optional Excel BOM for DXF method — kept with geometries for session restore after Complete. */
  const [dxfMethodExcel, setDxfMethodExcel] = useState<DxfMethodExcelSnapshot | null>(null);

  /** Step 2: picker vs merged quote-lines view (same step number for the stepper). */
  const [quoteMethodSubView, setQuoteMethodSubView] = useState<"picker" | "merged">("picker");
  /** How we entered stock (step 7) — drives Back target from pricing. */
  const [stockEntrySource, setStockEntrySource] = useState<"merged" | "method" | "legacy">(
    "legacy"
  );

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
  }, []);

  const goToStep = useCallback(
    (s: QuickQuoteStep) => {
      if (s <= highestStepReached) {
        if (s === 2) setQuoteMethodSubView("picker");
        setStep(s);
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
    const rows = calculationRows;
    if (rows && rows.length > 0) {
      const stock = stockPricingReady ? thicknessStock : null;
      return buildSelectionBundle(
        rows,
        stock,
        stock ? materialPricePerKg : undefined
      );
    }
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
    const mockRows = calculationRows ?? MOCK_VALIDATION_ROWS;
    const stock = stockPricingReady ? thicknessStock : null;
    return buildSelectionBundle(
      mockRows,
      stock,
      stock ? materialPricePerKg : undefined
    );
  }, [
    bendPlateQuoteItems,
    manualQuoteRows,
    excelImportQuoteRows,
    dxfMethodGeometries,
    materialType,
    calculationRows,
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
    setQuoteMethodSubView("picker");
    advanceTo(2);
  };

  const handleBackFromQuoteMethod = () => {
    setQuoteMethodSubView("picker");
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
    setQuoteMethodSubView("merged");
  }, [
    materialType,
    manualQuoteRows,
    excelImportQuoteRows,
    dxfMethodGeometries,
    bendPlateQuoteItems,
  ]);

  const handleResetQuoteMethodPicker = useCallback(() => {
    clearAllQuoteMethodData();
  }, [clearAllQuoteMethodData]);

  const handleConfigureMethodFromPicker = useCallback(
    (method: QuoteCreationMethod) => {
      setJobDetails((j) => ({ ...j, quoteCreationMethod: method }));
      advanceTo(3);
    },
    [advanceTo]
  );

  const handleBackFromMergedLines = useCallback(() => {
    setQuoteMethodSubView("picker");
  }, []);

  const handleContinueFromMergedLines = useCallback(() => {
    const parts = mergeAllQuoteMethodParts(
      materialType,
      manualQuoteRows,
      excelImportQuoteRows,
      dxfMethodGeometries,
      bendPlateQuoteItems
    );
    if (parts.length === 0) return;
    setStockEntrySource("merged");
    setThicknessStock((prev) =>
      mergeDefaultStockRows(parts, prev, materialType, getPurchasedSheetSizes())
    );
    advanceTo(7);
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
    setQuoteMethodSubView("picker");
  }, [clearAllQuoteMethodData]);

  const handleContinueFromMethodDetails = useCallback(() => {
    if (!jobDetails.quoteCreationMethod) {
      advanceTo(4);
      return;
    }
    setStockEntrySource("method");
    const parts = mergeAllQuoteMethodParts(
      materialType,
      manualQuoteRows,
      excelImportQuoteRows,
      dxfMethodGeometries,
      bendPlateQuoteItems
    );
    setThicknessStock((prev) =>
      mergeDefaultStockRows(parts, prev, materialType, getPurchasedSheetSizes())
    );
    advanceTo(7);
  }, [
    jobDetails.quoteCreationMethod,
    materialType,
    manualQuoteRows,
    excelImportQuoteRows,
    dxfMethodGeometries,
    bendPlateQuoteItems,
    advanceTo,
  ]);

  const handleBackFromMethodDetails = () => {
    setQuoteMethodSubView("picker");
    advanceTo(2);
  };

  const handleExcelDataApproved = (data: ExcelRow[]) => {
    setExcelData(data);
    advanceTo(5);
  };

  const handleBackToExcelUpload = () => advanceTo(3);

  const handleDxfDataApproved = useCallback((data: DxfPartGeometry[]) => {
    setDxfData(data);

    // Build validation data from Excel and DXF
    if (excelData && excelData.length > 0) {
      const validation = buildValidationData(excelData, data, materialType);
      setValidationRows(validation.rows);
      setValidationSummary(validation.summary);
    }

    advanceTo(6);
  }, [excelData, materialType, advanceTo]);

  const handleBackToDxfUpload = () => advanceTo(4);

  const handlePlateSelectionFromValidation = (selected: ValidationRow[]) => {
    setCalculationRows(selected);
    setStockEntrySource("legacy");
    const parts = quotePartsForValidationSelection(selected);
    setThicknessStock((prev) =>
      mergeDefaultStockRows(parts, prev, materialType, getPurchasedSheetSizes())
    );
    advanceTo(7);
  };

  const handleBackFromStockToValidation = useCallback(() => {
    if (stockEntrySource === "merged") {
      setQuoteMethodSubView("merged");
      advanceTo(2);
      return;
    }
    if (stockEntrySource === "method") {
      advanceTo(3);
      return;
    }
    advanceTo(6);
  }, [stockEntrySource, advanceTo]);

  const handleContinueFromStockToCalculation = () => {
    setCalcRunId((id) => id + 1);
    advanceTo(8);
  };

  const handleBackFromCalculationToStock = () => advanceTo(7);
  const handleViewQuote = () => advanceTo(9);
  const handleBackFromQuote = () => advanceTo(8);
  const handleBackToValidationFromQuote = useCallback(() => {
    if (stockEntrySource === "merged") {
      setQuoteMethodSubView("merged");
      advanceTo(2);
      return;
    }
    if (stockEntrySource === "method") {
      advanceTo(7);
      return;
    }
    advanceTo(6);
  }, [stockEntrySource, advanceTo]);

  const buildFinalizeDraft = useCallback(
    (): QuotePdfFullPayload =>
      buildQuotePdfFullPayload(
        jobDetails,
        selection.jobSummary,
        selection.parts,
        selection.mfgParams,
        selection.pricing
      ),
    [jobDetails, selection]
  );

  const handleContinueToFinalize = useCallback(() => {
    setPdfExportDraft(buildFinalizeDraft());
    advanceTo(10);
  }, [advanceTo, buildFinalizeDraft]);

  const handleBackFromFinalize = useCallback(() => {
    advanceTo(9);
  }, [advanceTo]);

  useEffect(() => {
    if (step === 10 && pdfExportDraft === null) {
      setPdfExportDraft(buildFinalizeDraft());
    }
  }, [step, pdfExportDraft, buildFinalizeDraft]);

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

  // Validation for step 1 (General)
  const canContinueFromGeneral = useMemo(() => {
    return jobDetails.customerName.trim().length > 0;
  }, [jobDetails.customerName]);

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

  // Determine which buttons to show and handlers
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
      case 3: {
        const canContinueMethodDetails =
          jobDetails.quoteCreationMethod === "bendPlate"
            ? bendPlateQuoteItems.length > 0
            : jobDetails.quoteCreationMethod === "manualAdd"
              ? manualQuoteRows.length > 0
              : jobDetails.quoteCreationMethod === "excelImport"
                ? excelImportQuoteRows.length > 0
                : jobDetails.quoteCreationMethod === "dxf"
                  ? dxfMethodHasQuotableParts(dxfMethodGeometries)
                  : true;
        return {
          showBack: true,
          showContinue: true,
          canContinue: canContinueMethodDetails,
          onBack: handleBackFromMethodDetails,
          onContinue: handleContinueFromMethodDetails,
        };
      }
      case 4:
        return {
          showBack: true,
          showContinue: false,
          canContinue: false,
          onBack: handleBackToExcelUpload,
        };
      case 5:
        return {
          showBack: true,
          showContinue: false,
          canContinue: false,
          onBack: handleBackToDxfUpload,
        };
      case 6:
        return {
          showBack: true,
          showContinue: true,
          canContinue: true,
          onBack: handleBackToDxfUpload,
          onContinue: () => handlePlateSelectionFromValidation(MOCK_VALIDATION_ROWS),
        };
      case 7:
        return {
          showBack: true,
          showContinue: true,
          canContinue: stockPricingReady,
          onBack: handleBackFromStockToValidation,
          onContinue: handleContinueFromStockToCalculation,
        };
      case 8:
        return {
          showBack: true,
          showContinue: true,
          canContinue: true,
          onBack: handleBackFromCalculationToStock,
          onContinue: handleViewQuote,
        };
      case 9:
        return {
          showBack: true,
          showContinue: true,
          canContinue: true,
          onBack: handleBackFromQuote,
          onContinue: handleContinueToFinalize,
        };
      case 10:
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
    jobDetails.quoteCreationMethod,
    bendPlateQuoteItems.length,
    manualQuoteRows.length,
    excelImportQuoteRows.length,
    dxfMethodGeometries,
    handleBackFromMethodDetails,
    handleContinueFromMethodDetails,
    handleBackToExcelUpload,
    handleBackToDxfUpload,
    handlePlateSelectionFromValidation,
    handleBackFromStockToValidation,
    handleContinueFromStockToCalculation,
    handleBackFromCalculationToStock,
    handleViewQuote,
    handleBackFromQuote,
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
          "bg-muted/20 flex-1 min-h-0",
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
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">General</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Quote details and client information
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

          {step === 2 && quoteMethodSubView === "merged" && (
            <MergedQuoteLinesStep
              parts={mergedQuotePartsList}
              currency={jobDetails.currency}
              onBack={handleBackFromMergedLines}
              onReset={handleResetMergedLines}
              onContinue={handleContinueFromMergedLines}
              canContinue={hasAnyQuoteMethodData}
              canReset={hasAnyQuoteMethodData}
            />
          )}

          {step === 3 && (
            <MethodDetailsRouter
              method={jobDetails.quoteCreationMethod ?? null}
              onBackToMethodPicker={handleBackFromMethodDetails}
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

          {step === 4 && (
            <ExcelUploadStep onDataApproved={handleExcelDataApproved} />
          )}

          {step === 5 && (
            <DxfUploadStep
              materialType={materialType}
              defaultThickness={10}
              onDataApproved={handleDxfDataApproved}
            />
          )}

        {step === 6 && (
          <>
            {validationRows.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No Data to Validate</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please complete the Excel and DXF upload phases first.
                  </p>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={handleBackToDxfUpload}>
                    Back to DXF Upload
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ValidationStep
                summary={validationSummary}
                rows={validationRows}
                onBack={handleBackToDxfUpload}
                onContinue={handlePlateSelectionFromValidation}
              />
            )}
          </>
        )}

        {step === 7 && (
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

        {step === 8 && (
          <CalculationStep
            key={calcRunId}
            runId={calcRunId}
            jobDetails={jobDetails}
            dxfFileCount={dxfFiles.length}
            uniquePlatesInRun={selection.parts.length}
            totalPartsQty={selection.jobSummary.totalQty}
            validationSummary={selection.validationSummary}
            onBack={handleBackFromCalculationToStock}
            onViewQuote={handleViewQuote}
          />
        )}

        {step === 9 && (
          <QuoteSummaryStep
            jobDetails={jobDetails}
            jobSummary={selection.jobSummary}
            parts={selection.parts}
            mfgParams={selection.mfgParams}
            pricing={selection.pricing}
            thicknessStock={
              thicknessStock.length > 0 ? thicknessStock : undefined
            }
            onBack={handleBackFromQuote}
            onBackToValidation={handleBackToValidationFromQuote}
            onContinueToFinalize={handleContinueToFinalize}
          />
        )}

        {step === 10 && pdfExportDraft && (
          <QuoteFinalizeExportStep
            draft={pdfExportDraft}
            setDraft={(action) => {
              setPdfExportDraft((prev) => {
                if (prev === null) return prev;
                return typeof action === "function" ? action(prev) : action;
              });
            }}
            onBack={handleBackFromFinalize}
          />
        )}
        </div>
      </PageContainer>
    </div>
  );
}
