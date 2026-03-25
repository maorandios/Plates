"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nanoid } from "@/lib/utils/nanoid";
import {
  getPurchasedSheetSizes,
  savePurchasedSheetSizes,
} from "@/lib/store";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { parseLengthInputToMm } from "@/lib/settings/unitSystem";
import type { PurchasedSheetSize } from "@/types/settings";

function sortCatalog(rows: PurchasedSheetSize[]): PurchasedSheetSize[] {
  return [...rows].sort((a, b) => {
    if (a.thicknessMm !== b.thicknessMm) return a.thicknessMm - b.thicknessMm;
    if (a.widthMm !== b.widthMm) return a.widthMm - b.widthMm;
    return a.lengthMm - b.lengthMm;
  });
}

export function PurchasedSheetSizesCard() {
  const { getUnitSystem, formatLengthValue } = useAppPreferences();
  const unitSystem = getUnitSystem();

  const [rows, setRows] = useState<PurchasedSheetSize[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setRows(sortCatalog(getPurchasedSheetSizes()));
    setMounted(true);
  }, []);

  const persist = useCallback((next: PurchasedSheetSize[]) => {
    const sorted = sortCatalog(next);
    setRows(sorted);
    savePurchasedSheetSizes(sorted);
  }, []);

  const addRow = useCallback(() => {
    const now = new Date().toISOString();
    persist([
      ...rows,
      {
        id: nanoid(),
        label: "",
        widthMm: 3000,
        lengthMm: 1500,
        thicknessMm: 10,
        updatedAt: now,
      },
    ]);
  }, [rows, persist]);

  const removeRow = useCallback(
    (id: string) => {
      persist(rows.filter((r) => r.id !== id));
    },
    [rows, persist]
  );

  const patchRow = useCallback(
    (id: string, patch: Partial<PurchasedSheetSize>) => {
      const now = new Date().toISOString();
      persist(
        rows.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: now } : r
        )
      );
    },
    [rows, persist]
  );

  const sorted = useMemo(() => sortCatalog(rows), [rows]);

  if (!mounted) {
    return (
      <Card id="purchased-sheets" className="border border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Purchased sheet sizes</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card id="purchased-sheets" className="border border-border shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Purchased sheet sizes</CardTitle>
        <CardDescription>
          Define the steel sheet sizes you keep in stock, per plate thickness. In{" "}
          <strong className="text-foreground font-medium">Stock configuration</strong>{" "}
          (per batch), you can pick one of these instead of typing width and length each time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="secondary" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add size
          </Button>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed border-border bg-muted/20">
            No sizes yet. Add the sheet dimensions you buy for each thickness (e.g. 3000 ×
            1500 mm at 10 mm).
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-semibold min-w-[140px]">
                    Label <span className="text-muted-foreground font-normal">(optional)</span>
                  </TableHead>
                  <TableHead className="text-xs font-semibold w-[120px]">
                    Width ({unitSystem === "metric" ? "mm" : "in"})
                  </TableHead>
                  <TableHead className="text-xs font-semibold w-[120px]">
                    Length ({unitSystem === "metric" ? "mm" : "in"})
                  </TableHead>
                  <TableHead className="text-xs font-semibold w-[100px]">
                    Thickness (mm)
                  </TableHead>
                  <TableHead className="w-[52px] text-right pr-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <PurchasedSheetRow
                    key={row.id}
                    row={row}
                    unitSystem={unitSystem}
                    formatLengthValue={formatLengthValue}
                    onPatch={(patch) => patchRow(row.id, patch)}
                    onRemove={() => removeRow(row.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PurchasedSheetRow({
  row,
  unitSystem,
  formatLengthValue,
  onPatch,
  onRemove,
}: {
  row: PurchasedSheetSize;
  unitSystem: "metric" | "imperial";
  formatLengthValue: (mm: number) => string;
  onPatch: (patch: Partial<PurchasedSheetSize>) => void;
  onRemove: () => void;
}) {
  const [wStr, setWStr] = useState(() => formatLengthValue(row.widthMm));
  const [lStr, setLStr] = useState(() => formatLengthValue(row.lengthMm));
  const [tStr, setTStr] = useState(String(row.thicknessMm));

  useEffect(() => {
    setWStr(formatLengthValue(row.widthMm));
    setLStr(formatLengthValue(row.lengthMm));
    setTStr(String(row.thicknessMm));
  }, [row.id, row.widthMm, row.lengthMm, row.thicknessMm, formatLengthValue]);

  function commitW() {
    const mm = parseLengthInputToMm(wStr, unitSystem);
    if (mm != null && mm > 0) onPatch({ widthMm: mm });
    else setWStr(formatLengthValue(row.widthMm));
  }
  function commitL() {
    const mm = parseLengthInputToMm(lStr, unitSystem);
    if (mm != null && mm > 0) onPatch({ lengthMm: mm });
    else setLStr(formatLengthValue(row.lengthMm));
  }
  function commitT() {
    const v = parseFloat(tStr.replace(",", "."));
    if (Number.isFinite(v) && v > 0) onPatch({ thicknessMm: v });
    else setTStr(String(row.thicknessMm));
  }

  return (
    <TableRow>
      <TableCell className="py-2">
        <Input
          className="h-9 text-sm"
          value={row.label}
          placeholder="e.g. Full sheet"
          onChange={(e) => onPatch({ label: e.target.value })}
        />
      </TableCell>
      <TableCell className="py-2">
        <Input
          className="h-9 font-mono tabular-nums text-sm"
          value={wStr}
          onChange={(e) => setWStr(e.target.value)}
          onBlur={commitW}
        />
      </TableCell>
      <TableCell className="py-2">
        <Input
          className="h-9 font-mono tabular-nums text-sm"
          value={lStr}
          onChange={(e) => setLStr(e.target.value)}
          onBlur={commitL}
        />
      </TableCell>
      <TableCell className="py-2">
        <Input
          className="h-9 font-mono tabular-nums text-sm w-[88px]"
          value={tStr}
          onChange={(e) => setTStr(e.target.value)}
          onBlur={commitT}
        />
      </TableCell>
      <TableCell className="py-2 text-right pr-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove size"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
