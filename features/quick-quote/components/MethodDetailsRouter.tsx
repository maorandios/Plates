"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MaterialType } from "@/types/materials";
import type { DxfPartGeometry } from "@/types";
import type { BendPlateQuoteItem } from "../bend-plate/types";
import type {
  DxfMethodExcelSnapshot,
  ManualQuotePartRow,
  QuoteCreationMethod,
} from "../types/quickQuote";
import { BendPlateQuotePhase } from "./method-phases/BendPlateQuotePhase";
import { DxfQuotePhase } from "./method-phases/DxfQuotePhase";
import { ExcelImportQuotePhase } from "./method-phases/ExcelImportQuotePhase";
import { ManualQuotePhase } from "./method-phases/ManualQuotePhase";

interface MethodDetailsRouterProps {
  method: QuoteCreationMethod | null;
  onBackToMethodPicker: () => void;
  materialType: MaterialType;
  manualQuoteRows: ManualQuotePartRow[];
  onManualQuoteRowsChange: (rows: ManualQuotePartRow[]) => void;
  onExcelImportQuoteRowsChange: (rows: ManualQuotePartRow[]) => void;
  excelImportQuoteRows: ManualQuotePartRow[];
  bendPlateQuoteItems: BendPlateQuoteItem[];
  onBendPlateAddItem: (item: BendPlateQuoteItem) => void;
  onBendPlateUpdateItem: (item: BendPlateQuoteItem) => void;
  onBendPlateRemoveItem: (id: string) => void;
  onDxfMethodGeometriesChange: (geometries: DxfPartGeometry[]) => void;
  dxfMethodGeometries: DxfPartGeometry[];
  dxfMethodExcel: DxfMethodExcelSnapshot | null;
  onDxfMethodExcelChange: (payload: DxfMethodExcelSnapshot | null) => void;
}

export function MethodDetailsRouter({
  method,
  onBackToMethodPicker,
  materialType,
  manualQuoteRows,
  onManualQuoteRowsChange,
  onExcelImportQuoteRowsChange,
  excelImportQuoteRows,
  bendPlateQuoteItems,
  onBendPlateAddItem,
  onBendPlateUpdateItem,
  onBendPlateRemoveItem,
  onDxfMethodGeometriesChange,
  dxfMethodGeometries,
  dxfMethodExcel,
  onDxfMethodExcelChange,
}: MethodDetailsRouterProps) {
  if (!method) {
    return (
      <Card className="mx-auto max-w-md border-0 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">No method selected</CardTitle>
          <CardDescription>Choose how you want to create this quote first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={onBackToMethodPicker}>
            Back to quote method
          </Button>
        </CardContent>
      </Card>
    );
  }

  const shell = (children: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
  );

  switch (method) {
    case "dxf":
      return shell(
        <DxfQuotePhase
          materialType={materialType}
          savedDxfGeometries={dxfMethodGeometries}
          savedDxfExcel={dxfMethodExcel}
          onSavedDxfExcelChange={onDxfMethodExcelChange}
          onGeometriesApproved={onDxfMethodGeometriesChange}
          onBack={onBackToMethodPicker}
          onComplete={onBackToMethodPicker}
        />
      );
    case "manualAdd":
      return shell(
        <ManualQuotePhase
          materialType={materialType}
          rows={manualQuoteRows}
          onRowsChange={onManualQuoteRowsChange}
          onBack={onBackToMethodPicker}
          onComplete={onBackToMethodPicker}
        />
      );
    case "excelImport":
      return shell(
        <ExcelImportQuotePhase
          materialType={materialType}
          onRowsChange={onExcelImportQuoteRowsChange}
          savedRows={excelImportQuoteRows}
          onBack={onBackToMethodPicker}
          onComplete={onBackToMethodPicker}
        />
      );
    case "bendPlate":
      return shell(
        <BendPlateQuotePhase
          materialType={materialType}
          quoteItems={bendPlateQuoteItems}
          onAddItem={onBendPlateAddItem}
          onUpdateItem={onBendPlateUpdateItem}
          onRemoveItem={onBendPlateRemoveItem}
          onBack={onBackToMethodPicker}
          onComplete={onBackToMethodPicker}
        />
      );
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}
