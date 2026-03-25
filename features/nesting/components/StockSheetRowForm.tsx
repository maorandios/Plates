"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  formatAreaValueOnly,
  formatLengthValueOnly,
  parseLengthInputToMm,
} from "@/lib/settings/unitSystem";
import {
  areaM2FromSheetMm,
  validateStockSheetEntry,
} from "@/lib/nesting/stockConfiguration";
import type { PurchasedSheetSize, UnitSystem } from "@/types/settings";
import type { StockSheetEntry, StockSheetType } from "@/types/nesting";
import { cn } from "@/lib/utils";

function matchCatalogId(
  entry: StockSheetEntry,
  catalog: PurchasedSheetSize[],
  tol = 0.02
): string {
  for (const c of catalog) {
    if (
      Math.abs(entry.widthMm - c.widthMm) < tol &&
      Math.abs(entry.lengthMm - c.lengthMm) < tol
    ) {
      return c.id;
    }
  }
  return "__manual__";
}

interface StockSheetRowFormProps {
  entry: StockSheetEntry;
  groupThicknessMm: number | null;
  /** Saved sizes from Preferences for this thickness (may be empty). */
  catalog: PurchasedSheetSize[];
  unitSystem: UnitSystem;
  onPatch: (id: string, patch: Partial<StockSheetEntry>) => void;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<StockSheetType, string> = {
  purchase: "Purchase",
  leftover: "Leftover",
};

export function StockSheetRowForm({
  entry,
  groupThicknessMm,
  catalog,
  unitSystem,
  onPatch,
  onDelete,
}: StockSheetRowFormProps) {
  const [wStr, setWStr] = useState(() =>
    formatLengthValueOnly(entry.widthMm, unitSystem)
  );
  const [lStr, setLStr] = useState(() =>
    formatLengthValueOnly(entry.lengthMm, unitSystem)
  );
  const [wErr, setWErr] = useState<string | undefined>();
  const [lErr, setLErr] = useState<string | undefined>();

  useEffect(() => {
    setWStr(formatLengthValueOnly(entry.widthMm, unitSystem));
    setLStr(formatLengthValueOnly(entry.lengthMm, unitSystem));
    setWErr(undefined);
    setLErr(undefined);
  }, [
    entry.id,
    entry.widthMm,
    entry.lengthMm,
    unitSystem,
  ]);

  const areaM2 = areaM2FromSheetMm(entry.widthMm, entry.lengthMm);
  const v = validateStockSheetEntry(entry);

  function commitWidth() {
    const mm = parseLengthInputToMm(wStr, unitSystem);
    if (mm != null && mm > 0) {
      setWErr(undefined);
      onPatch(entry.id, { widthMm: mm });
    } else {
      const msg = "Enter a value greater than 0";
      setWErr(msg);
      setWStr(formatLengthValueOnly(entry.widthMm, unitSystem));
    }
  }

  function commitLength() {
    const mm = parseLengthInputToMm(lStr, unitSystem);
    if (mm != null && mm > 0) {
      setLErr(undefined);
      onPatch(entry.id, { lengthMm: mm });
    } else {
      setLErr("Enter a value greater than 0");
      setLStr(formatLengthValueOnly(entry.lengthMm, unitSystem));
    }
  }

  const thicknessLabel =
    groupThicknessMm != null && Number.isFinite(groupThicknessMm)
      ? formatLengthValueOnly(groupThicknessMm, unitSystem)
      : "—";

  const rawCatalogMatch = matchCatalogId(entry, catalog);
  const catalogSelectValue =
    catalog.length === 0
      ? "__manual__"
      : rawCatalogMatch !== "__manual__" &&
          catalog.some((c) => c.id === rawCatalogMatch)
        ? rawCatalogMatch
        : "__manual__";

  function catalogLabel(c: PurchasedSheetSize): string {
    const w = formatLengthValueOnly(c.widthMm, unitSystem);
    const l = formatLengthValueOnly(c.lengthMm, unitSystem);
    const base = `${w} × ${l}`;
    const name = c.label?.trim();
    return name ? `${name} · ${base}` : base;
  }

  return (
    <TableRow
      className={cn(
        !v.ok && "bg-destructive/[0.06]",
        "hover:bg-muted/40"
      )}
    >
      <TableCell className="py-2 pr-2 pl-3 min-w-[200px] max-w-[260px]">
        <Select
          value={catalogSelectValue}
          onValueChange={(val) => {
            if (val === "__manual__") return;
            const c = catalog.find((x) => x.id === val);
            if (c) {
              onPatch(entry.id, { widthMm: c.widthMm, lengthMm: c.lengthMm });
            }
          }}
          disabled={catalog.length === 0}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue
              placeholder={
                catalog.length === 0 ? "No saved sizes" : "Pick or type below"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__manual__">Custom (manual)</SelectItem>
            {catalog.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {catalogLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-2 pr-2 pl-0 w-[120px]">
        <Input
          className={cn(
            "h-9 font-mono tabular-nums text-sm",
            wErr && "border-destructive"
          )}
          value={wStr}
          onChange={(e) => {
            setWStr(e.target.value);
            setWErr(undefined);
          }}
          onBlur={commitWidth}
          aria-invalid={!!wErr}
        />
        {wErr ? (
          <p className="text-[11px] text-destructive mt-1">{wErr}</p>
        ) : null}
      </TableCell>
      <TableCell className="py-2 pr-2 w-[120px]">
        <Input
          className={cn(
            "h-9 font-mono tabular-nums text-sm",
            lErr && "border-destructive"
          )}
          value={lStr}
          onChange={(e) => {
            setLStr(e.target.value);
            setLErr(undefined);
          }}
          onBlur={commitLength}
          aria-invalid={!!lErr}
        />
        {lErr ? (
          <p className="text-[11px] text-destructive mt-1">{lErr}</p>
        ) : null}
      </TableCell>
      <TableCell className="py-2 pr-2">
        <span className="text-sm font-mono tabular-nums text-muted-foreground">
          {thicknessLabel}
        </span>
      </TableCell>
      <TableCell className="py-2 pr-2 text-right">
        <span className="text-sm font-mono tabular-nums text-foreground">
          {formatAreaValueOnly(areaM2, unitSystem)}
        </span>
      </TableCell>
      <TableCell className="py-2 pr-2 min-w-[132px]">
        <Select
          value={entry.type}
          onValueChange={(val) =>
            onPatch(entry.id, { type: val as StockSheetType })
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="purchase">{TYPE_LABELS.purchase}</SelectItem>
            <SelectItem value="leftover">{TYPE_LABELS.leftover}</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-2 pr-3 w-[52px] text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(entry.id)}
          aria-label="Delete stock sheet row"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
