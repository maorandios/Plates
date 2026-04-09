"use client";

import { useCallback, useMemo } from "react";
import type { MaterialType } from "@/types/materials";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import type { ExcelRow } from "@/types";
import { ExcelUploadStep } from "../ExcelUploadStep";
import type { ManualQuotePartRow } from "../../types/quickQuote";
import { excelRowsToManualQuoteRows } from "../../lib/manualQuoteParts";

interface ExcelImportQuotePhaseProps {
  materialType: MaterialType;
  onRowsChange: (rows: ManualQuotePartRow[]) => void;
  /** Persisted lines when user returns from quote method — reopen on review step. */
  savedRows: ManualQuotePartRow[];
  onBack: () => void;
  onComplete: () => void;
}

export function ExcelImportQuotePhase({
  materialType,
  onRowsChange,
  savedRows,
  onBack,
  onComplete,
}: ExcelImportQuotePhaseProps) {
  const densityKgPerM3 = useMemo(
    () => getMaterialConfig(materialType).densityKgPerM3,
    [materialType]
  );

  const sync = useCallback(
    (excel: ExcelRow[]) => {
      onRowsChange(excelRowsToManualQuoteRows(excel, materialType));
    },
    [materialType, onRowsChange]
  );

  return (
    <ExcelUploadStep
      variant="quoteImport"
      onDataApproved={sync}
      onQuoteImportRowsChange={sync}
      quoteImportDensityKgPerM3={densityKgPerM3}
      quoteImportMaterialType={materialType}
      onPhaseBack={onBack}
      onPhaseComplete={onComplete}
      quoteImportRestoredRows={savedRows}
    />
  );
}
