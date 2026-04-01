"use client";

import { useCallback, useMemo } from "react";
import type { MaterialType } from "@/types/materials";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import type { ExcelRow } from "@/types";
import { ExcelUploadStep } from "../ExcelUploadStep";
import type { ManualQuotePartRow } from "../../types/quickQuote";
import {
  DEFAULT_PLATE_FINISH,
  defaultMaterialGradeForFamily,
  parsePlateFinishFromLabelOrValue,
} from "../../lib/plateFields";

interface ExcelImportQuotePhaseProps {
  materialType: MaterialType;
  onRowsChange: (rows: ManualQuotePartRow[]) => void;
}

function excelRowsToManualRows(
  rows: ExcelRow[],
  materialType: MaterialType
): ManualQuotePartRow[] {
  return rows.map((r) => {
    const partNumber = r.partName.trim() || "—";
    return {
      id: r.id,
      partNumber,
      thicknessMm: r.thickness ?? 0,
      widthMm: r.width ?? 0,
      lengthMm: r.length ?? 0,
      quantity: Math.max(1, Math.floor(r.quantity) || 1),
      material: (r.material ?? "").trim() || defaultMaterialGradeForFamily(materialType),
      finish: parsePlateFinishFromLabelOrValue(r.finish) ?? DEFAULT_PLATE_FINISH,
      sourceMethod: "excelImport" as const,
      clientPartLabel: partNumber,
    };
  });
}

export function ExcelImportQuotePhase({
  materialType,
  onRowsChange,
}: ExcelImportQuotePhaseProps) {
  const densityKgPerM3 = useMemo(
    () => getMaterialConfig(materialType).densityKgPerM3,
    [materialType]
  );

  const sync = useCallback(
    (excel: ExcelRow[]) => {
      onRowsChange(excelRowsToManualRows(excel, materialType));
    },
    [materialType, onRowsChange]
  );

  return (
    <ExcelUploadStep
      variant="quoteImport"
      onDataApproved={sync}
      onQuoteImportRowsChange={sync}
      quoteImportDensityKgPerM3={densityKgPerM3}
    />
  );
}
