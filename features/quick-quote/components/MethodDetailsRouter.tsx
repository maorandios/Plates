"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MaterialType } from "@/types/materials";
import type { BendPlateQuoteItem } from "../bend-plate/types";
import type { ManualQuotePartRow, QuoteCreationMethod } from "../types/quickQuote";
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
  bendPlateQuoteItems: BendPlateQuoteItem[];
  onBendPlateAddItem: (item: BendPlateQuoteItem) => void;
  onBendPlateUpdateItem: (item: BendPlateQuoteItem) => void;
  onBendPlateRemoveItem: (id: string) => void;
}

export function MethodDetailsRouter({
  method,
  onBackToMethodPicker,
  materialType,
  manualQuoteRows,
  onManualQuoteRowsChange,
  onExcelImportQuoteRowsChange,
  bendPlateQuoteItems,
  onBendPlateAddItem,
  onBendPlateUpdateItem,
  onBendPlateRemoveItem,
}: MethodDetailsRouterProps) {
  if (!method) {
    return (
      <Card className="max-w-md mx-auto border-dashed">
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

  switch (method) {
    case "dxf":
      return <DxfQuotePhase />;
    case "manualAdd":
      return (
        <ManualQuotePhase
          materialType={materialType}
          rows={manualQuoteRows}
          onRowsChange={onManualQuoteRowsChange}
          onBack={onBackToMethodPicker}
          onComplete={onBackToMethodPicker}
        />
      );
    case "excelImport":
      return (
        <ExcelImportQuotePhase
          materialType={materialType}
          onRowsChange={onExcelImportQuoteRowsChange}
        />
      );
    case "bendPlate":
      return (
        <BendPlateQuotePhase
          materialType={materialType}
          quoteItems={bendPlateQuoteItems}
          onAddItem={onBendPlateAddItem}
          onUpdateItem={onBendPlateUpdateItem}
          onRemoveItem={onBendPlateRemoveItem}
        />
      );
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}
