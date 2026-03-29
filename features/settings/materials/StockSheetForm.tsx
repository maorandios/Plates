"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import type { MaterialStockSheet } from "@/types/materials";

interface StockSheetFormProps {
  sheet: MaterialStockSheet;
  isNew: boolean;
  onSave: (sheet: MaterialStockSheet) => void;
  onCancel: () => void;
}

function sortUniqueThicknesses(mm: number[]): number[] {
  return [...new Set(mm)].filter((t) => t > 0).sort((a, b) => a - b);
}

export function StockSheetForm({ sheet, isNew, onSave, onCancel }: StockSheetFormProps) {
  const { parseLengthInputToMm, formatLengthValue, formatAreaValue } = useAppPreferences();
  const [width, setWidth] = useState(formatLengthValue(sheet.widthMm));
  const [length, setLength] = useState(formatLengthValue(sheet.lengthMm));
  const [thicknessesMm, setThicknessesMm] = useState<number[]>(() =>
    sortUniqueThicknesses(sheet.thicknessesMm ?? [])
  );
  const [addingOpen, setAddingOpen] = useState(false);
  const [newThicknessRaw, setNewThicknessRaw] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWidth(formatLengthValue(sheet.widthMm));
    setLength(formatLengthValue(sheet.lengthMm));
    setThicknessesMm(sortUniqueThicknesses(sheet.thicknessesMm ?? []));
    setAddingOpen(false);
    setNewThicknessRaw("");
  }, [sheet.id]);

  useEffect(() => {
    if (addingOpen) {
      inputRef.current?.focus();
    }
  }, [addingOpen]);

  const tryAddThickness = useCallback((raw: string) => {
    const t = raw.trim().replace(",", ".");
    if (t === "") {
      setAddingOpen(false);
      setNewThicknessRaw("");
      return;
    }
    const n = Number.parseFloat(t);
    if (!Number.isFinite(n) || n <= 0) {
      setNewThicknessRaw("");
      setAddingOpen(false);
      return;
    }
    setThicknessesMm((prev) => sortUniqueThicknesses([...prev, n]));
    setNewThicknessRaw("");
    setAddingOpen(false);
  }, []);

  const removeThickness = useCallback((mm: number) => {
    setThicknessesMm((prev) => prev.filter((t) => t !== mm));
  }, []);

  function handleSave() {
    const widthMm = parseLengthInputToMm(width);
    const lengthMm = parseLengthInputToMm(length);

    if (widthMm == null || !Number.isFinite(widthMm) || widthMm <= 0) {
      alert("Width must be > 0");
      return;
    }
    if (lengthMm == null || !Number.isFinite(lengthMm) || lengthMm <= 0) {
      alert("Length must be > 0");
      return;
    }

    const sorted = sortUniqueThicknesses(thicknessesMm);
    if (sorted.length === 0) {
      alert("Add at least one thickness.");
      return;
    }

    onSave({
      ...sheet,
      widthMm,
      lengthMm,
      thicknessesMm: sorted,
      updatedAt: new Date().toISOString(),
    });
  }

  const previewAreaM2 = (() => {
    const w = parseLengthInputToMm(width);
    const l = parseLengthInputToMm(length);
    if (w != null && l != null && Number.isFinite(w) && Number.isFinite(l) && w > 0 && l > 0) {
      return formatAreaValue((w * l) / 1_000_000);
    }
    return "—";
  })();

  return (
    <Card className="border-2 border-primary/40 shadow-md">
      <CardHeader>
        <CardTitle className="text-base">
          {isNew ? "Add stock sheet" : "Edit stock sheet"}
        </CardTitle>
        <CardDescription>
          Sheet size and which plate thicknesses you keep in that size.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sheet-width">Width</Label>
            <Input
              id="sheet-width"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="1250"
              autoFocus={isNew}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sheet-length">Length</Label>
            <Input
              id="sheet-length"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder="2500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Available thicknesses (mm)</Label>
          <div className="flex min-h-[42px] flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
            {thicknessesMm.map((mm) => (
              <Badge
                key={mm}
                variant="secondary"
                className="gap-1 pr-1 pl-2.5 text-sm font-medium tabular-nums"
              >
                {formatLengthValue(mm)}
                <button
                  type="button"
                  onClick={() => removeThickness(mm)}
                  className="ml-0.5 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${mm} mm`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {addingOpen ? (
              <Input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={newThicknessRaw}
                onChange={(e) => setNewThicknessRaw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    tryAddThickness(newThicknessRaw);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setNewThicknessRaw("");
                    setAddingOpen(false);
                  }
                }}
                onBlur={(e) => {
                  const v = e.currentTarget.value;
                  if (v.trim() === "") {
                    setAddingOpen(false);
                  } else {
                    tryAddThickness(v);
                  }
                }}
                placeholder="mm"
                className="h-8 w-24 border-primary/50 text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAddingOpen(true);
                  setNewThicknessRaw("");
                }}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-foreground"
              >
                Add new thickness <span className="text-base leading-none">+</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Values are stored in millimetres. Click &quot;Add new thickness&quot;, type a number, press Enter.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">Preview area</p>
          <p className="text-lg font-semibold tabular-nums">{previewAreaM2}</p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" size="sm" onClick={handleSave}>
            <Check className="h-4 w-4 mr-1.5" />
            Save
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
