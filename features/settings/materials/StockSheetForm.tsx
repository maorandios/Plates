"use client";

import { useEffect, useState } from "react";
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
import { t } from "@/lib/i18n";
import type { MaterialStockSheet, MaterialType } from "@/types/materials";

const SK = "settings.materials" as const;

interface StockSheetFormProps {
  sheet: MaterialStockSheet;
  isNew: boolean;
  materialType: MaterialType;
  onSave: (sheet: MaterialStockSheet) => void;
  onCancel: () => void;
}

export function StockSheetForm({
  sheet,
  isNew,
  materialType,
  onSave,
  onCancel,
}: StockSheetFormProps) {
  const { parseLengthInputToMm, formatLengthValue, formatAreaValue } = useAppPreferences();
  const [width, setWidth] = useState(formatLengthValue(sheet.widthMm));
  const [length, setLength] = useState(formatLengthValue(sheet.lengthMm));

  const idPrefix = `${materialType}-${sheet.id}`;

  useEffect(() => {
    setWidth(formatLengthValue(sheet.widthMm));
    setLength(formatLengthValue(sheet.lengthMm));
  }, [sheet.id, sheet.widthMm, sheet.lengthMm, formatLengthValue]);

  function handleSave() {
    const widthMm = parseLengthInputToMm(width);
    const lengthMm = parseLengthInputToMm(length);

    if (widthMm == null || !Number.isFinite(widthMm) || widthMm <= 0) {
      alert(t(`${SK}.widthInvalid`));
      return;
    }
    if (lengthMm == null || !Number.isFinite(lengthMm) || lengthMm <= 0) {
      alert(t(`${SK}.lengthInvalid`));
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
    <Card className="border-2 border-primary/40 shadow-md" dir="rtl">
      <CardHeader className="text-start space-y-1.5">
        <CardTitle className="text-base">
          {isNew ? t(`${SK}.formAddTitle`) : t(`${SK}.formEditTitle`)}
        </CardTitle>
        <CardDescription className="leading-relaxed">{t(`${SK}.formDescription`)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 text-start">
            <Label htmlFor={`${idPrefix}-width`} className="text-start">
              {t(`${SK}.colWidth`)}
            </Label>
            <Input
              id={`${idPrefix}-width`}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="1250"
              autoFocus={isNew}
              dir="ltr"
              className="text-start"
            />
          </div>
          <div className="space-y-2 text-start">
            <Label htmlFor={`${idPrefix}-length`} className="text-start">
              {t(`${SK}.colLength`)}
            </Label>
            <Input
              id={`${idPrefix}-length`}
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder="2500"
              dir="ltr"
              className="text-start"
            />
          </div>
        </div>

        <div className="rounded-lg bg-muted/30 px-4 py-3 text-start">
          <p className="mb-1 text-xs text-muted-foreground">{t(`${SK}.previewArea`)}</p>
          <p className="text-lg font-semibold tabular-nums" dir="ltr">
            {previewAreaM2}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" size="sm" className="gap-1.5" onClick={handleSave}>
            <Check className="h-4 w-4" />
            {t(`${SK}.save`)}
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onCancel}>
            <X className="h-4 w-4" />
            {t(`${SK}.cancel`)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
