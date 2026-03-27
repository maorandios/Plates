"use client";

import type { ReactNode } from "react";
import { Layers, Ruler, Scale, Scissors, CircleDot } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobSummaryMetrics } from "../types/quickQuote";

interface QuoteSummaryCardsProps {
  metrics: JobSummaryMetrics;
}

export function QuoteSummaryCards({ metrics }: QuoteSummaryCardsProps) {
  const items: {
    label: string;
    value: string;
    sub?: string;
    icon: ReactNode;
  }[] = [
    {
      label: "Unique parts",
      value: String(metrics.uniqueParts),
      icon: <Layers className="h-4 w-4" />,
    },
    {
      label: "Total quantity",
      value: String(metrics.totalQty),
      icon: <Layers className="h-4 w-4 opacity-70" />,
    },
    {
      label: "Total plate area",
      value: `${metrics.totalPlateAreaM2.toFixed(2)} m²`,
      icon: <Ruler className="h-4 w-4" />,
    },
    {
      label: "Est. weight",
      value: `${metrics.totalEstWeightKg.toFixed(1)} kg`,
      icon: <Scale className="h-4 w-4" />,
    },
    {
      label: "Cut length",
      value: `${(metrics.totalCutLengthMm / 1000).toFixed(2)} m`,
      sub: `${metrics.totalCutLengthMm.toLocaleString()} mm`,
      icon: <Scissors className="h-4 w-4" />,
    },
    {
      label: "Pierce count",
      value: metrics.totalPierceCount.toLocaleString(),
      icon: <CircleDot className="h-4 w-4" />,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {item.label}
            </CardTitle>
            <span className="text-muted-foreground">{item.icon}</span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-semibold tabular-nums tracking-tight">
              {item.value}
            </p>
            {item.sub && (
              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                {item.sub}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
