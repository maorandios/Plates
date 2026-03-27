"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ManufacturingParameters } from "../../types/quickQuote";
import { InsightStatCard } from "./InsightStatCard";
import { MarginSliderControl } from "./MarginSliderControl";
import { PriceImpactChart } from "./PriceImpactChart";
import { SheetCountSensitivityPanel } from "./SheetCountSensitivityPanel";

interface MarginImpactPanelProps {
  marginPercent: number;
  onMarginChange: (n: number) => void;
  baseCost: number;
  finalQuotePrice: number;
  profitAmount: number;
  pricePerKg: number;
  pricePerKgUnavailable: boolean;
  formatCurrency: (n: number) => string;
  mfgParams: ManufacturingParameters;
}

export function MarginImpactPanel({
  marginPercent,
  onMarginChange,
  baseCost,
  finalQuotePrice,
  profitAmount,
  pricePerKg,
  pricePerKgUnavailable,
  formatCurrency,
  mfgParams,
}: MarginImpactPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-stretch">
      <Card className="border-border shadow-sm min-w-0 bg-muted/15 dark:bg-muted/25 h-full flex flex-col">
        <CardContent className="pt-6 flex flex-col flex-1 gap-4 min-h-0 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide min-h-[1.25rem] leading-none">
            Margin & price curve
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0 auto-rows-fr">
            <InsightStatCard label="Final quote price" value={formatCurrency(finalQuotePrice)} />
            <InsightStatCard label="Profit amount" value={formatCurrency(profitAmount)} />
            <InsightStatCard
              label="Price / kg"
              value={pricePerKgUnavailable ? "—" : formatCurrency(pricePerKg)}
            />
          </div>

          <div className="min-w-0 pt-1 border-b border-border/60 pb-4 shrink-0">
            <MarginSliderControl value={marginPercent} onChange={onMarginChange} />
          </div>
          <div className="min-h-0 flex flex-col flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
              Price impact by margin
            </p>
            <div className="mt-2 flex-1 min-h-[220px]">
              <PriceImpactChart
                baseCost={baseCost}
                currentMarginPercent={marginPercent}
                formatCurrency={formatCurrency}
                className="mt-0 h-full min-h-[220px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm min-w-0 bg-muted/15 dark:bg-muted/25 h-full flex flex-col">
        <CardContent className="pt-6 flex flex-col flex-1 gap-4 min-h-0 min-w-0">
          <SheetCountSensitivityPanel mfgParams={mfgParams} />
        </CardContent>
      </Card>
    </div>
  );
}
