"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GeneralSection } from "./GeneralSection";
import { MethodDetailsRouter } from "./MethodDetailsRouter";
import { QuoteMethodStep } from "./QuoteMethodStep";
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
  ManualQuotePartRow,
  QuickQuoteJobDetails,
  QuickQuoteStep,
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
import { bendPlateQuoteItemsToQuoteParts } from "../bend-plate/toQuoteParts";
import { manualQuoteRowsToQuoteParts } from "../lib/manualQuoteParts";
import type { BendPlateQuoteItem } from "../bend-plate/types";
import { generateQuoteReference } from "../lib/generateQuoteReference";
import { MOCK_MFG_PARAMETERS } from "../mock/quickQuoteMockData";
import type { QuotePdfFullPayload } from "../lib/quotePdfPayload";
import { buildQuotePdfFullPayload } from "../lib/quotePdfPayload";
import type { MaterialType } from "@/types/materials";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { normalizeName } from "@/lib/matching/matcher";
import { getPurchasedSheetSizes } from "@/lib/store";
import { nanoid } from "@/lib/utils/nanoid";

const defaultJobDetails: QuickQuoteJobDetails = {
  referenceNumber: "",
  customerName: "",
  currency: "EUR",
  notes: "",
};

// Tolerance for dimension matching (5% difference allowed)
const DIMENSION_TOLERANCE = 0.05;
const WEIGHT_TOLERANCE = 0.1; // 10% for weight

function buildValidationData(
  excelRows: ExcelRow[],
  dxfGeometries: DxfPartGeometry[],
  materialType: MaterialType
): { rows: ValidationRow[]; summary: ValidationSummary } {
  const materialConfig = getMaterialConfig(materialType);
  const densityKgPerM3 = materialConfig.densityKgPerM3;
  
  const rows: ValidationRow[] = [];
  let matched = 0;
  let warnings = 0;
  let critical = 0;

  // Match Excel rows to DXF geometries by normalized part name
  for (const excelRow of excelRows) {
    const excelNorm = normalizeName(excelRow.partName);
    
    // Find best matching DXF
    let bestDxf: DxfPartGeometry | null = null;
    let bestScore = 0;
    
    for (const dxf of dxfGeometries) {
      const dxfNorm = normalizeName(dxf.guessedPartName);
      
      // Simple similarity check
      if (dxfNorm === excelNorm) {
        bestScore = 1;
        bestDxf = dxf;
        break;
      }
      
      // Partial match
      if (dxfNorm.includes(excelNorm) || excelNorm.includes(dxfNorm)) {
        const score = 0.7;
        if (score > bestScore) {
          bestScore = score;
          bestDxf = dxf;
        }
      }
    }

    const geom = bestDxf?.processedGeometry;
    const bbox = geom?.boundingBox;
    
    // Get DXF dimensions (raw from bounding box)
    const dxfDim1 = bbox?.width || 0;
    const dxfDim2 = bbox?.height || 0;
    
    // Get Excel dimensions
    const excelLengthMm = excelRow.length || 0;
    const excelWidthMm = excelRow.width || 0;
    
    // Sort dimensions to compare largest to largest (handles rotation)
    const excelDimensions = [excelLengthMm, excelWidthMm].sort((a, b) => b - a);
    const dxfDimensions = [dxfDim1, dxfDim2].sort((a, b) => b - a);
    
    // Assign sorted dimensions for display (larger = length, smaller = width)
    const dxfLengthMm = dxfDimensions[0];
    const dxfWidthMm = dxfDimensions[1];
    
    const dxfAreaM2 = geom ? geom.area / 1000000 : 0;
    const dxfWeightKg = geom 
      ? (geom.area / 1000000) * ((excelRow.thickness || 10) / 1000) * densityKgPerM3
      : 0;
    
    // Excel dimensions and weight
    const excelAreaM2 = excelRow.area || 0;
    const excelWeightKg = excelRow.weight || 0;
    
    // Check for mismatches
    const mismatchFields: string[] = [];
    let status: "valid" | "warning" | "error" = "valid";
    
    if (!bestDxf) {
      mismatchFields.push("DXF file not found");
      status = "error";
    } else {
      // Check dimensions (compare sorted dimensions to handle rotation)
      if (excelDimensions[0] > 0 && dxfDimensions[0] > 0) {
        const lengthDiff = Math.abs(excelDimensions[0] - dxfDimensions[0]) / excelDimensions[0];
        if (lengthDiff > DIMENSION_TOLERANCE) {
          mismatchFields.push("Length");
          if (status === "valid") status = "warning";
        }
      }
      
      if (excelDimensions[1] > 0 && dxfDimensions[1] > 0) {
        const widthDiff = Math.abs(excelDimensions[1] - dxfDimensions[1]) / excelDimensions[1];
        if (widthDiff > DIMENSION_TOLERANCE) {
          mismatchFields.push("Width");
          if (status === "valid") status = "warning";
        }
      }
      
      if (excelAreaM2 > 0 && dxfAreaM2 > 0) {
        const areaDiff = Math.abs(excelAreaM2 - dxfAreaM2) / excelAreaM2;
        if (areaDiff > DIMENSION_TOLERANCE) {
          mismatchFields.push("Area");
          if (status === "valid") status = "warning";
        }
      }
      
      if (excelWeightKg > 0 && dxfWeightKg > 0) {
        const weightDiff = Math.abs(excelWeightKg - dxfWeightKg) / excelWeightKg;
        if (weightDiff > WEIGHT_TOLERANCE) {
          mismatchFields.push("Weight");
          if (status === "valid") status = "warning";
        }
      }
      
      // Check material (critical error)
      if (excelRow.material && bestDxf.materialGrade) {
        const excelMat = normalizeName(excelRow.material);
        const dxfMat = normalizeName(bestDxf.materialGrade);
        if (excelMat !== dxfMat) {
          mismatchFields.push("Material");
          status = "error";
        }
      }
    }
    
    // Count statuses
    if (status === "valid") {
      matched++;
    } else if (status === "warning") {
      warnings++;
    } else if (status === "error") {
      critical++;
    }
    
    const thicknessMm = excelRow.thickness ?? 10;
    const dxfPerimeterMm = geom?.perimeter ?? 0;
    const dxfPiercingCount =
      geom?.preparation?.manufacturing?.cutInner?.length ?? 0;

    rows.push({
      id: nanoid(),
      partName: excelRow.partName,
      qty: excelRow.quantity,
      thicknessMm,
      excelLengthMm,
      dxfLengthMm,
      excelWidthMm,
      dxfWidthMm,
      excelAreaM2,
      dxfAreaM2,
      excelWeightKg,
      dxfWeightKg,
      dxfPerimeterMm,
      dxfPiercingCount,
      excelMaterial: excelRow.material || "-",
      dxfMaterial: bestDxf?.materialGrade || "-",
      status,
      dxfFileName: bestDxf?.guessedPartName || "Not found",
      mismatchFields,
      suggestedReason: mismatchFields.length > 0 
        ? `Discrepancy detected in: ${mismatchFields.join(", ")}`
        : "All fields match within tolerance",
      actionRecommendation: status === "error"
        ? "Review and correct the data before proceeding"
        : status === "warning"
        ? "Minor differences detected - verify if acceptable"
        : "No action required",
    });
  }

  return {
    rows,
    summary: {
      totalRows: rows.length,
      matched,
      warnings,
      critical,
    },
  };
}

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
      if (s <= highestStepReached) setStep(s);
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
    if (jobDetails.quoteCreationMethod === "bendPlate") {
      const parts = bendPlateQuoteItemsToQuoteParts(bendPlateQuoteItems);
      const stock = stockPricingReady ? thicknessStock : null;
      return buildSelectionBundleFromParts(
        parts,
        stock,
        stock ? materialPricePerKg : undefined
      );
    }
    if (jobDetails.quoteCreationMethod === "manualAdd") {
      const density = getMaterialConfig(materialType).densityKgPerM3;
      const parts = manualQuoteRowsToQuoteParts(manualQuoteRows, density);
      const stock = stockPricingReady ? thicknessStock : null;
      return buildSelectionBundleFromParts(
        parts,
        stock,
        stock ? materialPricePerKg : undefined
      );
    }
    if (jobDetails.quoteCreationMethod === "excelImport") {
      const density = getMaterialConfig(materialType).densityKgPerM3;
      const parts = manualQuoteRowsToQuoteParts(excelImportQuoteRows, density);
      const stock = stockPricingReady ? thicknessStock : null;
      return buildSelectionBundleFromParts(
        parts,
        stock,
        stock ? materialPricePerKg : undefined
      );
    }
    const rows = calculationRows ?? MOCK_VALIDATION_ROWS;
    const stock = stockPricingReady ? thicknessStock : null;
    return buildSelectionBundle(
      rows,
      stock,
      stock ? materialPricePerKg : undefined
    );
  }, [
    jobDetails.quoteCreationMethod,
    bendPlateQuoteItems,
    manualQuoteRows,
    excelImportQuoteRows,
    materialType,
    calculationRows,
    thicknessStock,
    materialPricePerKg,
    stockPricingReady,
  ]);

  const handleContinueFromGeneral = () => advanceTo(2);
  const handleContinueFromQuoteMethod = () => advanceTo(3);
  const handleBackFromQuoteMethod = () => advanceTo(1);

  const handleContinueFromMethodDetails = useCallback(() => {
    if (jobDetails.quoteCreationMethod === "bendPlate") {
      const parts = bendPlateQuoteItemsToQuoteParts(bendPlateQuoteItems);
      setThicknessStock((prev) =>
        mergeDefaultStockRows(parts, prev, materialType, getPurchasedSheetSizes())
      );
      advanceTo(7);
      return;
    }
    if (jobDetails.quoteCreationMethod === "manualAdd") {
      const density = getMaterialConfig(materialType).densityKgPerM3;
      const parts = manualQuoteRowsToQuoteParts(manualQuoteRows, density);
      setThicknessStock((prev) =>
        mergeDefaultStockRows(parts, prev, materialType, getPurchasedSheetSizes())
      );
      advanceTo(7);
      return;
    }
    if (jobDetails.quoteCreationMethod === "excelImport") {
      const density = getMaterialConfig(materialType).densityKgPerM3;
      const parts = manualQuoteRowsToQuoteParts(excelImportQuoteRows, density);
      setThicknessStock((prev) =>
        mergeDefaultStockRows(parts, prev, materialType, getPurchasedSheetSizes())
      );
      advanceTo(7);
      return;
    }
    advanceTo(4);
  }, [
    jobDetails.quoteCreationMethod,
    bendPlateQuoteItems,
    manualQuoteRows,
    excelImportQuoteRows,
    materialType,
    advanceTo,
  ]);

  const handleBackFromMethodDetails = () => advanceTo(2);

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
    const parts = quotePartsForValidationSelection(selected);
    setThicknessStock((prev) =>
      mergeDefaultStockRows(parts, prev, materialType, getPurchasedSheetSizes())
    );
    advanceTo(7);
  };

  const handleBackFromStockToValidation = useCallback(() => {
    if (
      jobDetails.quoteCreationMethod === "bendPlate" ||
      jobDetails.quoteCreationMethod === "manualAdd" ||
      jobDetails.quoteCreationMethod === "excelImport"
    ) {
      advanceTo(3);
      return;
    }
    advanceTo(6);
  }, [jobDetails.quoteCreationMethod, advanceTo]);

  const handleContinueFromStockToCalculation = () => {
    setCalcRunId((id) => id + 1);
    advanceTo(8);
  };

  const handleBackFromCalculationToStock = () => advanceTo(7);
  const handleViewQuote = () => advanceTo(9);
  const handleBackFromQuote = () => advanceTo(8);
  const handleBackToValidationFromQuote = useCallback(() => {
    if (
      jobDetails.quoteCreationMethod === "bendPlate" ||
      jobDetails.quoteCreationMethod === "manualAdd" ||
      jobDetails.quoteCreationMethod === "excelImport"
    ) {
      advanceTo(7);
      return;
    }
    advanceTo(6);
  }, [jobDetails.quoteCreationMethod, advanceTo]);

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

  const canContinueFromQuoteMethod = Boolean(jobDetails.quoteCreationMethod);

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
          showBack: true,
          showContinue: true,
          canContinue: canContinueFromQuoteMethod,
          onBack: handleBackFromQuoteMethod,
          onContinue: handleContinueFromQuoteMethod,
        };
      case 3: {
        const canContinueMethodDetails =
          jobDetails.quoteCreationMethod === "bendPlate"
            ? bendPlateQuoteItems.length > 0
            : jobDetails.quoteCreationMethod === "manualAdd"
              ? manualQuoteRows.length > 0
              : jobDetails.quoteCreationMethod === "excelImport"
                ? excelImportQuoteRows.length > 0
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
    canContinueFromQuoteMethod,
    handleContinueFromGeneral,
    handleBackFromQuoteMethod,
    handleContinueFromQuoteMethod,
    jobDetails.quoteCreationMethod,
    bendPlateQuoteItems.length,
    manualQuoteRows.length,
    excelImportQuoteRows.length,
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
      <PageContainer className="bg-muted/20 flex-1 overflow-y-auto">
        <div className="w-full space-y-8">
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

          {step === 2 && (
            <QuoteMethodStep
              selected={jobDetails.quoteCreationMethod ?? null}
              onSelect={(method) => {
                setJobDetails((j) => ({ ...j, quoteCreationMethod: method }));
              }}
            />
          )}

          {step === 3 && (
            <MethodDetailsRouter
              method={jobDetails.quoteCreationMethod ?? null}
              onBackToMethodPicker={() => advanceTo(2)}
              materialType={materialType}
              manualQuoteRows={manualQuoteRows}
              onManualQuoteRowsChange={setManualQuoteRows}
              onExcelImportQuoteRowsChange={setExcelImportQuoteRows}
              bendPlateQuoteItems={bendPlateQuoteItems}
              onBendPlateAddItem={handleBendPlateAddItem}
              onBendPlateUpdateItem={handleBendPlateUpdateItem}
              onBendPlateRemoveItem={handleBendPlateRemoveItem}
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
