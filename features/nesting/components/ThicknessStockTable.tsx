"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  tableAreaHeader,
  tableLengthHeader,
  tableThicknessHeader,
  tableWidthHeader,
  formatLengthValueOnly,
} from "@/lib/settings/unitSystem";
import type { PurchasedSheetSize, UnitSystem } from "@/types/settings";
import type { StockSheetEntry } from "@/types/nesting";
import { StockSheetRowForm } from "./StockSheetRowForm";

interface ThicknessStockTableProps {
  groupThicknessMm: number | null;
  rows: StockSheetEntry[];
  catalogForGroup: PurchasedSheetSize[];
  unitSystem: UnitSystem;
  onAddRow: () => void;
  /** Add a row with dimensions from the purchased-sheet catalogue (Preferences). */
  onAddRowFromCatalog: (widthMm: number, lengthMm: number) => void;
  onPatchRow: (id: string, patch: Partial<StockSheetEntry>) => void;
  onDeleteRow: (id: string) => void;
}

function catalogOptionLabel(
  c: PurchasedSheetSize,
  unitSystem: UnitSystem
): string {
  const w = formatLengthValueOnly(c.widthMm, unitSystem);
  const l = formatLengthValueOnly(c.lengthMm, unitSystem);
  const base = `${w} × ${l}`;
  const name = c.label?.trim();
  return name ? `${name} · ${base}` : base;
}

export function ThicknessStockTable({
  groupThicknessMm,
  rows,
  catalogForGroup,
  unitSystem,
  onAddRow,
  onAddRowFromCatalog,
  onPatchRow,
  onDeleteRow,
}: ThicknessStockTableProps) {
  const [pickedCatalogId, setPickedCatalogId] = useState("");

  useEffect(() => {
    if (catalogForGroup.length === 0) {
      setPickedCatalogId("");
      return;
    }
    setPickedCatalogId((prev) =>
      catalogForGroup.some((c) => c.id === prev)
        ? prev
        : catalogForGroup[0]!.id
    );
  }, [catalogForGroup]);

  const picked =
    pickedCatalogId &&
    catalogForGroup.find((c) => c.id === pickedCatalogId);

  return (
    <div className="space-y-4">
      {catalogForGroup.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/8 to-transparent px-4 py-3.5 space-y-3">
          <div className="flex items-start gap-2">
            <LayoutGrid className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Purchased sheet catalogue
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                These sizes come from{" "}
                <Link
                  href="/settings/materials#purchased-sheets"
                  className="underline font-medium text-foreground hover:text-primary"
                >
                  Preferences
                </Link>
                . Choose one and add a row, or scroll down to enter width and length
                manually in the table.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={pickedCatalogId || catalogForGroup[0]!.id}
              onValueChange={setPickedCatalogId}
            >
              <SelectTrigger className="h-10 w-full sm:w-[min(100%,22rem)] text-sm">
                <SelectValue placeholder="Select a saved size" />
              </SelectTrigger>
              <SelectContent>
                {catalogForGroup.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {catalogOptionLabel(c, unitSystem)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 shrink-0"
              disabled={!picked}
              onClick={() => {
                if (picked) {
                  onAddRowFromCatalog(picked.widthMm, picked.lengthMm);
                }
              }}
            >
              <Plus className="h-4 w-4" />
              Add sheet from catalogue
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 gap-y-2">
        {groupThicknessMm != null &&
          Number.isFinite(groupThicknessMm) &&
          catalogForGroup.length === 0 && (
            <p className="text-xs text-muted-foreground max-w-md leading-snug">
              No purchased sheet sizes for this thickness in{" "}
              <Link
                href="/settings/materials#purchased-sheets"
                className="underline font-medium text-foreground hover:text-primary"
              >
                Preferences
              </Link>
              . Add sizes there to enable the catalogue above, or enter dimensions
              manually below.
            </p>
          )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5 shrink-0 ml-auto"
          onClick={onAddRow}
        >
          <Plus className="h-4 w-4" />
          Add sheet (manual)
        </Button>
      </div>

      <div className="rounded-lg overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
              <TableHead className="text-xs font-semibold h-10 py-2 pl-3 min-w-[200px]">
                Saved size
              </TableHead>
              <TableHead className="text-xs font-semibold h-10 py-2">
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground py-10 px-4"
                >
                  <p className="max-w-md mx-auto leading-relaxed">
                    No stock lines yet for this thickness.
                    {catalogForGroup.length > 0 ? (
                      <>
                        {" "}
                        Use <strong className="text-foreground">Purchased sheet
                        catalogue</strong> above, or{" "}
                        <strong className="text-foreground">Add sheet (manual)</strong>{" "}
                        to type width and length. The <strong className="text-foreground">
                          Saved size
                        </strong>{" "}
                        column appears on each row to re-apply a catalogue entry.
                      </>
                    ) : (
                      <>
                        {" "}
                        Click <strong className="text-foreground">Add sheet (manual)</strong>{" "}
                        to enter dimensions. Optional: define catalogue sizes in{" "}
                        <Link
                          href="/settings/materials#purchased-sheets"
                          className="underline font-medium text-foreground hover:text-primary"
                        >
                          Preferences
                        </Link>{" "}
                        for quick picks.
                      </>
                    )}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((entry) => (
                <StockSheetRowForm
                  key={entry.id}
                  entry={entry}
                  groupThicknessMm={groupThicknessMm}
                  catalog={catalogForGroup}
                  unitSystem={unitSystem}
                  onPatch={onPatchRow}
                  onDelete={onDeleteRow}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
