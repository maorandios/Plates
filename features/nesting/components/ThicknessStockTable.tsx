"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  tableAreaHeader,
  tableLengthHeader,
  tableThicknessHeader,
  tableWidthHeader,
} from "@/lib/settings/unitSystem";
import type { UnitSystem } from "@/types/settings";
import type { StockSheetEntry } from "@/types/nesting";
import { StockSheetRowForm } from "./StockSheetRowForm";

interface ThicknessStockTableProps {
  groupThicknessMm: number | null;
  rows: StockSheetEntry[];
  unitSystem: UnitSystem;
  onAddRow: () => void;
  onPatchRow: (id: string, patch: Partial<StockSheetEntry>) => void;
  onDeleteRow: (id: string) => void;
}

export function ThicknessStockTable({
  groupThicknessMm,
  rows,
  unitSystem,
  onAddRow,
  onPatchRow,
  onDeleteRow,
}: ThicknessStockTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={onAddRow}>
          <Plus className="h-4 w-4" />
          Add sheet
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-dashed border-border bg-muted/20">
          No stock sheets assigned for this thickness yet.
        </p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                <TableHead className="text-xs font-semibold h-10 py-2 pl-3">
                  {tableWidthHeader(unitSystem)}
                </TableHead>
                <TableHead className="text-xs font-semibold h-10 py-2">
                  {tableLengthHeader(unitSystem)}
                </TableHead>
                <TableHead className="text-xs font-semibold h-10 py-2">
                  {tableThicknessHeader(unitSystem)}
                </TableHead>
                <TableHead className="text-xs font-semibold h-10 py-2 text-right">
                  {tableAreaHeader(unitSystem)}
                </TableHead>
                <TableHead className="text-xs font-semibold h-10 py-2 min-w-[100px]">
                  Type
                </TableHead>
                <TableHead className="text-xs font-semibold h-10 py-2 w-[52px] text-right pr-3">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => (
                <StockSheetRowForm
                  key={entry.id}
                  entry={entry}
                  groupThicknessMm={groupThicknessMm}
                  unitSystem={unitSystem}
                  onPatch={onPatchRow}
                  onDelete={onDeleteRow}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
