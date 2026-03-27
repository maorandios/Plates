"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarginSliderControl } from "./MarginSliderControl";
import { PriceImpactChart } from "./PriceImpactChart";
import { buildDynamicInsightLines } from "../quoteInsights.utils";

interface MarginImpactPanelProps {
  marginPercent: number;
  onMarginChange: (n: number) => void;
  baseCost: number;
  defaultMarginPercent: number;
  finalQuotePrice: number;
  profitAmount: number;
  pricePerKg: number;
  pricePerKgUnavailable: boolean;
  formatCurrency: (n: number) => string;
  formatKg: (kg: number) => string;
  totalWeightKg: number;
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums tracking-tight mt-1 text-foreground">
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function MarginImpactPanel({
  marginPercent,
  onMarginChange,
  baseCost,
  defaultMarginPercent,
  finalQuotePrice,
  profitAmount,
  pricePerKg,
  pricePerKgUnavailable,
  formatCurrency,
  formatKg,
  totalWeightKg,
}: MarginImpactPanelProps) {
  const insightLines = buildDynamicInsightLines(
    marginPercent,
    defaultMarginPercent,
    baseCost,
    formatCurrency
  );

  return (
    <Card className="border-border shadow-sm h-full flex flex-col">
      <CardHeader className="border-b border-border bg-muted/20 pb-4">
        <CardTitle className="text-base">Margin & price impact</CardTitle>
        <CardDescription>
          Margin is applied to base cost (material + cutting + piercing + setup + overhead).
          Charts and KPIs update instantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 flex flex-col flex-1 gap-6">
        <MarginSliderControl value={marginPercent} onChange={onMarginChange} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Kpi label="Final quote price" value={formatCurrency(finalQuotePrice)} />
          <Kpi label="Profit amount" value={formatCurrency(profitAmount)} />
          <Kpi
            label="Price / kg"
            value={
              pricePerKgUnavailable
                ? "—"
                : formatCurrency(pricePerKg)
            }
            sub={
              pricePerKgUnavailable
                ? "Weight not available"
                : `On ${formatKg(totalWeightKg)} estimated`
            }
          />
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Price impact by margin
          </p>
          <PriceImpactChart
            baseCost={baseCost}
            currentMarginPercent={marginPercent}
            formatCurrency={formatCurrency}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
          {insightLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
