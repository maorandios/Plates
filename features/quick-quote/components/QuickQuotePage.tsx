"use client";

import { useCallback, useMemo, useState } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { CalculationStep } from "./CalculationStep";
import { QuoteStepper } from "./QuoteStepper";
import { QuoteSummaryStep } from "./QuoteSummaryStep";
import { StockPricingStep } from "./StockPricingStep";
import { UploadStep } from "./UploadStep";
import { ValidationStep } from "./ValidationStep";
import type {
  QuickQuoteJobDetails,
  QuickQuoteStep,
  QuoteSheetStockLine,
  ThicknessStockInput,
  UploadedFileMeta,
  ValidationRow,
} from "../types/quickQuote";
import {
  MOCK_VALIDATION_ROWS,
  MOCK_VALIDATION_SUMMARY,
} from "../mock/quickQuoteMockData";
import {
  buildSelectionBundle,
  isThicknessStockComplete,
  mergeDefaultStockRows,
  quotePartsForValidationSelection,
} from "../lib/deriveQuoteSelection";
import { generateQuoteReference } from "../lib/generateQuoteReference";
import { MOCK_MFG_PARAMETERS } from "../mock/quickQuoteMockData";

const defaultJobDetails: QuickQuoteJobDetails = {
  referenceNumber: "",
  customerName: "",
  currency: "EUR",
  notes: "",
};

export function QuickQuotePage() {
  const [step, setStep] = useState<QuickQuoteStep>(1);
  const [highestStepReached, setHighestStepReached] = useState<QuickQuoteStep>(1);
  const [dxfFiles, setDxfFiles] = useState<UploadedFileMeta[]>([]);
  const [excelFile, setExcelFile] = useState<UploadedFileMeta | null>(null);
  const [jobDetails, setJobDetails] = useState<QuickQuoteJobDetails>(() => ({
    ...defaultJobDetails,
    referenceNumber: generateQuoteReference(),
  }));
  const [calcRunId, setCalcRunId] = useState(0);
  const [calculationRows, setCalculationRows] = useState<ValidationRow[] | null>(
    null
  );
  const [thicknessStock, setThicknessStock] = useState<ThicknessStockInput[]>([]);
  const [materialPricePerKg, setMaterialPricePerKg] = useState(
    () => MOCK_MFG_PARAMETERS.materialRatePerKg
  );

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

  const selection = useMemo(() => {
    const rows = calculationRows ?? MOCK_VALIDATION_ROWS;
    const stockReady =
      thicknessStock.length > 0 && isThicknessStockComplete(thicknessStock);
    const stock = stockReady ? thicknessStock : null;
    return buildSelectionBundle(
      rows,
      stock,
      stock ? materialPricePerKg : undefined
    );
  }, [calculationRows, thicknessStock, materialPricePerKg]);

  const handleContinueToValidation = () => advanceTo(2);
  const handleBackToUpload = () => advanceTo(1);

  const handlePlateSelectionFromValidation = (selected: ValidationRow[]) => {
    setCalculationRows(selected);
    const parts = quotePartsForValidationSelection(selected);
    setThicknessStock((prev) => mergeDefaultStockRows(parts, prev));
    advanceTo(3);
  };

  const handleBackFromStockToValidation = () => advanceTo(2);

  const handleContinueFromStockToCalculation = () => {
    setCalcRunId((id) => id + 1);
    advanceTo(4);
  };

  const handleBackFromCalculationToStock = () => advanceTo(3);
  const handleViewQuote = () => advanceTo(5);
  const handleBackFromQuote = () => advanceTo(4);
  const handleBackToValidationFromQuote = () => advanceTo(2);

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

  return (
    <PageContainer className="bg-muted/20">
      <div className="w-full space-y-8">
        <div className="rounded-xl border border-border bg-card px-4 py-5 sm:px-6 shadow-sm">
          <QuoteStepper
            currentStep={step}
            highestStepReached={highestStepReached}
            onStepSelect={goToStep}
          />
        </div>

        {step === 1 && (
          <UploadStep
            dxfFiles={dxfFiles}
            excelFile={excelFile}
            jobDetails={jobDetails}
            onDxfChange={setDxfFiles}
            onExcelChange={setExcelFile}
            onJobDetailsChange={setJobDetails}
            onContinue={handleContinueToValidation}
          />
        )}

        {step === 2 && (
          <ValidationStep
            summary={MOCK_VALIDATION_SUMMARY}
            rows={MOCK_VALIDATION_ROWS}
            onBack={handleBackToUpload}
            onContinue={handlePlateSelectionFromValidation}
          />
        )}

        {step === 3 && (
          <StockPricingStep
            jobSummary={selection.jobSummary}
            stockRows={thicknessStock}
            currencyCode={jobDetails.currency}
            materialPricePerKg={materialPricePerKg}
            onMaterialPriceChange={setMaterialPricePerKg}
            onSheetsChange={setSheetsForThickness}
            onBack={handleBackFromStockToValidation}
            onContinue={handleContinueFromStockToCalculation}
          />
        )}

        {step === 4 && (
          <CalculationStep
            key={calcRunId}
            runId={calcRunId}
            jobDetails={jobDetails}
            dxfFileCount={dxfFiles.length}
            uniquePlatesInRun={selection.validationRows.length}
            totalPartsQty={selection.jobSummary.totalQty}
            validationSummary={selection.validationSummary}
            onBack={handleBackFromCalculationToStock}
            onViewQuote={handleViewQuote}
          />
        )}

        {step === 5 && (
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
          />
        )}
      </div>
    </PageContainer>
  );
}
