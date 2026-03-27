"use client";

import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatQuickQuoteCurrency } from "../lib/quickQuoteCurrencies";
import type { PricingSummary } from "../types/quickQuote";

interface PricingSummaryCardProps {
  pricing: PricingSummary;
  currency: string;
}

export function PricingSummaryCard({ pricing, currency }: PricingSummaryCardProps) {
  const fmt = (n: number) => formatQuickQuoteCurrency(n, currency);

  const lines: { label: string; value: number }[] = [
    { label: "Material", value: pricing.materialCost },
    { label: "Cutting", value: pricing.cuttingCost },
    { label: "Piercing", value: pricing.piercingCost },
    { label: "Setup", value: pricing.setupCost },
    { label: "Overhead", value: pricing.overhead },
    { label: "Margin", value: pricing.margin },
  ];

  return (
    <Card className="border-border shadow-md overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/30 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Quote pricing summary</CardTitle>
            <CardDescription className="mt-1">
              Indicative totals — mock rates for UI preview
            </CardDescription>
          </div>
          <TrendingUp className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Estimated quote price
          </p>
          <p className="text-3xl font-bold tabular-nums tracking-tight mt-1">
            {fmt(pricing.finalEstimatedPrice)}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          {lines.map((row) => (
            <div key={row.label} className="flex justify-between gap-2 py-1">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium tabular-nums">{fmt(row.value)}</span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Price / kg</span>
            <span className="font-medium tabular-nums">{fmt(pricing.pricePerKg)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Avg / part (unique)</span>
            <span className="font-medium tabular-nums">{fmt(pricing.avgPricePerPart)}</span>
          </div>
          <div className="flex justify-between gap-2 sm:col-span-2">
            <span className="text-muted-foreground">Internal est. cost vs sell</span>
            <span className="font-medium tabular-nums">
              {fmt(pricing.internalEstCost)} → {fmt(pricing.finalEstimatedPrice)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
