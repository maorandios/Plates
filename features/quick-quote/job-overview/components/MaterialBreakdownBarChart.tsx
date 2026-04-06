"use client";

import { useMemo } from "react";
import { formatDecimal } from "@/lib/formatNumbers";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StockSheetSizeBreakdownRow } from "../jobOverview.types";

interface MaterialBreakdownBarChartProps {
  rows: StockSheetSizeBreakdownRow[];
  shareScopeLabel?: string;
  /** Full job with no filters: one bar per thickness (all materials & sizes combined). */
  groupedByThickness?: boolean;
}

function truncateLabel(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Stack to 100%: util + waste; derive waste from util to avoid rounding gaps. */
function stackPercents(r: StockSheetSizeBreakdownRow): {
  utilizationPct: number;
  wastePct: number;
} {
  const gross = r.grossStockAreaM2;
  if (gross <= 0) return { utilizationPct: 0, wastePct: 0 };
  const u = Math.round((r.netPlateAreaM2 / gross) * 1000) / 10;
  const w = Math.round((100 - u) * 10) / 10;
  return { utilizationPct: u, wastePct: w };
}

export function MaterialBreakdownBarChart({
  rows,
  shareScopeLabel = "job",
  groupedByThickness = false,
}: MaterialBreakdownBarChartProps) {
  const data = useMemo(
    () =>
      rows.map((r) => {
        const { utilizationPct, wastePct } = stackPercents(r);
        return {
          name: truncateLabel(r.label, 28),
          fullName: r.label,
          utilizationPct,
          wastePct,
          material: r.material,
          thicknessMm: r.thicknessMm,
        };
      }),
    [rows]
  );

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-16 text-center border border-dashed border-border rounded-lg">
        No part rows available.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="w-full h-[min(400px,52vh)] min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval={0}
              angle={data.length > 3 ? -32 : 0}
              textAnchor={data.length > 3 ? "end" : "middle"}
              height={data.length > 3 ? 72 : 40}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              width={44}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: "% of gross stock (each bar = 100%)",
                angle: -90,
                position: "insideLeft",
                offset: 8,
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as {
                  fullName: string;
                  utilizationPct: number;
                  wastePct: number;
                  material: string;
                  thicknessMm: number;
                };
                return (
                  <div className="rounded-md bg-popover px-3 py-2.5 text-xs shadow-md max-w-sm space-y-1.5">
                    <p className="font-semibold text-foreground leading-snug">{p.fullName}</p>
                    <p className="text-muted-foreground">
                      {shareScopeLabel} · {p.material} · {formatDecimal(p.thicknessMm, 1)} mm
                    </p>
                    <p className="text-muted-foreground tabular-nums">
                      <span className="text-primary font-medium">Util</span>{" "}
                      {formatDecimal(p.utilizationPct, 1)}% ·{" "}
                      <span className="text-destructive font-medium">Waste</span>{" "}
                      {formatDecimal(p.wastePct, 1)}%
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) => (
                <span className="text-muted-foreground">{value}</span>
              )}
            />
            {/* Bottom segment: utilization (net ÷ gross) */}
            <Bar
              dataKey="utilizationPct"
              stackId="full"
              name="Utilization"
              fill="hsl(var(--primary))"
              radius={[0, 0, 6, 6]}
              maxBarSize={56}
            >
              <LabelList
                dataKey="utilizationPct"
                position="center"
                fill="hsl(var(--primary-foreground))"
                fontSize={11}
                fontWeight={600}
                formatter={(label) => {
                  const v = typeof label === "number" ? label : Number(label);
                  if (!Number.isFinite(v) || v < 5) return "";
                  return `Util ${v.toFixed(0)}%`;
                }}
              />
            </Bar>
            {/* Top segment: waste — rounded top corners */}
            <Bar
              dataKey="wastePct"
              stackId="full"
              name="Waste"
              fill="hsl(var(--destructive))"
              fillOpacity={0.92}
              radius={[6, 6, 0, 0]}
              maxBarSize={56}
            >
              <LabelList
                dataKey="wastePct"
                position="center"
                fill="hsl(var(--destructive-foreground))"
                fontSize={11}
                fontWeight={600}
                formatter={(label) => {
                  const v = typeof label === "number" ? label : Number(label);
                  if (!Number.isFinite(v) || v < 5) return "";
                  return `Waste ${v.toFixed(0)}%`;
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground px-1">
        {groupedByThickness
          ? "One bar per thickness (all materials and sheet sizes combined)."
          : "One bar per line (material + thickness + sheet size)."}{" "}
        Each bar is 100% of gross stock:{" "}
        <span className="text-primary font-medium">Util</span> (net ÷ gross) stacked below,{" "}
        <span className="text-destructive font-medium">Waste</span> on top. Labels show inside each
        segment when there is room. {shareScopeLabel} scope.
      </p>
    </div>
  );
}
