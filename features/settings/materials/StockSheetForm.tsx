"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import type { MaterialStockSheet } from "@/types/materials";

interface StockSheetFormProps {
  sheet: MaterialStockSheet;
  isNew: boolean;
  onSave: (sheet: MaterialStockSheet) => void;
  onCancel: () => void;
}

export function StockSheetForm({ sheet, isNew, onSave, onCancel }: StockSheetFormProps) {
  const { parseLengthInputToMm, formatLengthValue, formatAreaValue } = useAppPreferences();
  const [width, setWidth] = useState(formatLengthValue(sheet.widthMm));
  const [length, setLength] = useState(formatLengthValue(sheet.lengthMm));

  useEffect(() => {
    setWidth(formatLengthValue(sheet.widthMm));
    setLength(formatLengthValue(sheet.lengthMm));
  }, [sheet.id, sheet.widthMm, sheet.lengthMm, formatLengthValue]);

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

    onSave({
      ...sheet,
      widthMm,
      lengthMm,
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
          Sheet size in stock. Applies to all thicknesses in the quote stock step.
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

        <div className="rounded-lg bg-muted/30 px-4 py-3">
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
