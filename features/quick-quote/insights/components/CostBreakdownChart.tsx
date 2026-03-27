"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CostBreakdownRow } from "../quoteInsights.types";

interface CostBreakdownChartProps {
  rows: CostBreakdownRow[];
  finalQuotePrice: number;
  formatCurrency: (n: number) => string;
}

export function CostBreakdownChart({
  rows,
  finalQuotePrice,
  formatCurrency,
}: CostBreakdownChartProps) {
  const chartData = useMemo(
    () => rows.map((r) => ({ ...r, name: r.label })),
    [rows]
  );

  const total = Math.max(1e-9, finalQuotePrice);

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 4, bottom: 52 }}
        >
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            interval={0}
            angle={-32}
            textAnchor="end"
            height={56}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickFormatter={(val) => formatCurrency(Number(val))}
            width={76}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as CostBreakdownRow;
              const pct = total > 0 ? (row.value / total) * 100 : 0;
              return (
                <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md max-w-[220px]">
                  <p className="font-medium text-foreground">{row.label}</p>
                  <p className="text-muted-foreground mt-1 tabular-nums">
                    {formatCurrency(row.value)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 tabular-nums">
                    {pct.toFixed(1)}% of final quote
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={48}>
            {chartData.map((entry) => (
              <Cell key={entry.key} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
