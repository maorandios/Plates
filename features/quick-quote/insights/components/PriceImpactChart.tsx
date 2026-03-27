"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildFinalQuotePrice, buildMarginChartData } from "../quoteInsights.utils";

interface PriceImpactChartProps {
  baseCost: number;
  currentMarginPercent: number;
  formatCurrency: (n: number) => string;
}


export function PriceImpactChart({
  baseCost,
  currentMarginPercent,
  formatCurrency,
}: PriceImpactChartProps) {
  const data = useMemo(() => buildMarginChartData(baseCost), [baseCost]);
  const currentY = useMemo(
    () => buildFinalQuotePrice(baseCost, currentMarginPercent),
    [baseCost, currentMarginPercent]
  );

  return (
    <div className="w-full h-[240px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            type="number"
            dataKey="marginPercent"
            domain={[0, 40]}
            ticks={[0, 10, 20, 30, 40]}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            label={{
              value: "Margin %",
              position: "insideBottom",
              offset: -2,
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickFormatter={(val) => formatCurrency(Number(val))}
            width={72}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as {
                marginPercent: number;
                finalQuotePrice: number;
              };
              return (
                <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-foreground tabular-nums">
                    {p.marginPercent}% margin
                  </p>
                  <p className="text-muted-foreground mt-1 tabular-nums">
                    Final price: {formatCurrency(p.finalQuotePrice)}
                  </p>
                </div>
              );
            }}
            cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "4 4" }}
          />
          <Line
            type="monotone"
            dataKey="finalQuotePrice"
            name="Final quote price"
            stroke="hsl(var(--foreground))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--foreground))" }}
          />
          <ReferenceDot
            x={currentMarginPercent}
            y={currentY}
            r={6}
            fill="hsl(var(--foreground))"
            stroke="hsl(var(--background))"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
