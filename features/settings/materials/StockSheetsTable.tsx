"use client";

import { useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import type { MaterialConfig, MaterialStockSheet } from "@/types/materials";
import { StockSheetForm } from "./StockSheetForm";
import { nanoid } from "@/lib/utils/nanoid";

interface StockSheetsTableProps {
  config: MaterialConfig;
  onUpdate: (patch: Partial<MaterialConfig>) => void;
}

export function StockSheetsTable({ config, onUpdate }: StockSheetsTableProps) {
  const { formatLengthValue, formatAreaValue } = useAppPreferences();
  const [editingSheet, setEditingSheet] = useState<MaterialStockSheet | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  function handleAdd() {
    const now = new Date().toISOString();
    const newSheet: MaterialStockSheet = {
      id: nanoid(),
      widthMm: 1000,
      lengthMm: 2000,
      enabled: true,
      updatedAt: now,
    };
    setEditingSheet(newSheet);
    setIsAdding(true);
  }

  function handleSave(sheet: MaterialStockSheet) {
    if (isAdding) {
      onUpdate({ stockSheets: [...config.stockSheets, sheet] });
    } else {
      onUpdate({
        stockSheets: config.stockSheets.map((s) => (s.id === sheet.id ? sheet : s)),
      });
    }
    setEditingSheet(null);
    setIsAdding(false);
  }

  function handleCancel() {
    setEditingSheet(null);
    setIsAdding(false);
  }

  function handleEdit(sheet: MaterialStockSheet) {
    setEditingSheet(sheet);
    setIsAdding(false);
  }

  function handleDelete(sheetId: string) {
    if (!confirm("Delete this stock sheet?")) return;
    onUpdate({
      stockSheets: config.stockSheets.filter((s) => s.id !== sheetId),
    });
  }

  const sorted = [...config.stockSheets].sort((a, b) => {
    const areaA = a.widthMm * a.lengthMm;
    const areaB = b.widthMm * b.lengthMm;
    return areaB - areaA;
  });

  return (
    <>
      <Card className="border border-border shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Stock sheets</CardTitle>
              <CardDescription>
                Sheet sizes you purchase. These apply to every plate thickness in the quote stock step.
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={handleAdd} disabled={isAdding || !!editingSheet}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add sheet
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No stock sheets defined. Click Add sheet to create one.
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Width</TableHead>
                    <TableHead className="w-[100px]">Length</TableHead>
                    <TableHead className="w-[120px]">Area</TableHead>
                    <TableHead className="w-[88px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((sheet) => {
                    const areaM2 = (sheet.widthMm * sheet.lengthMm) / 1_000_000;
                    return (
                      <TableRow key={sheet.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {formatLengthValue(sheet.widthMm)}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {formatLengthValue(sheet.lengthMm)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatAreaValue(areaM2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(sheet)}
                              disabled={!!editingSheet}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(sheet.id)}
                              disabled={!!editingSheet}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingSheet && (
        <StockSheetForm
          sheet={editingSheet}
          isNew={isAdding}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
