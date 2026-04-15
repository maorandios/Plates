"use client";

import { useMemo } from "react";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { t } from "@/lib/i18n";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StockSheetSizeBreakdownRow } from "../jobOverview.types";

const QA = "quote.quantityAnalysis" as const;

/** Phase 5 material breakdown stacked bars */
const CHART_UTIL = "#6A23F7";
const CHART_WASTE = "#530021";
const CHART_HOVER_BG = "#111C21";
/** 1.25× former default (~56px auto cap); use explicit `barSize` so width actually changes */
const BAR_WIDTH_PX = Math.round(56 * 1.25);
const BAR_LABEL_FONT = 11 * 1.25; // 13.75 — % labels on bars

/** Axis typography — prior sizes ÷1.25 */
const AXIS_X_TICK = 18;
const AXIS_Y_TICK = 11;

interface MaterialBreakdownBarChartProps {
  rows: StockSheetSizeBreakdownRow[];
}

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

export function MaterialBreakdownBarChart({ rows }: MaterialBreakdownBarChartProps) {
  const data = useMemo(
    () =>
      rows.map((r) => {
        const { utilizationPct, wastePct } = stackPercents(r);
        const mmDisplay = formatInteger(Math.round(r.thicknessMm));
        return {
          name: t(`${QA}.chartAxisPlateThickness`, { mm: mmDisplay }),
          utilizationPct,
          wastePct,
          thicknessMm: r.thicknessMm,
        };
      }),
    [rows, t]
  );

  const utilName = t(`${QA}.chartLegendUtil`);
  const wasteName = t(`${QA}.chartLegendWaste`);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-16 text-center border border-dashed border-border rounded-lg">
        {t(`${QA}.noPartRows`)}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="w-full h-[min(400px,52vh)] min-h-[280px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 12, bottom: 10 }}
            barCategoryGap="2%"
            barGap={0}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{
                fontSize: AXIS_X_TICK,
                fill: "hsl(var(--muted-foreground))",
              }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval={0}
              angle={data.length > 3 ? -32 : 0}
              textAnchor={data.length > 3 ? "end" : "middle"}
              height={data.length > 3 ? 120 : 56}
            />
            <YAxis
              orientation="left"
              domain={[0, 100]}
              tick={{
                fontSize: AXIS_Y_TICK,
                fill: "hsl(var(--muted-foreground))",
              }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              width={40}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              cursor={{ fill: CHART_HOVER_BG }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as {
                  utilizationPct: number;
                  wastePct: number;
                  thicknessMm: number;
                };
                return (
                  <div
                    className="max-w-sm space-y-1.5 rounded-md bg-popover px-3 py-2.5 text-start text-xs shadow-md"
                    dir="rtl"
                  >
                    <p className="tabular-nums text-foreground">
                      {t(`${QA}.chartTooltipLineThickness`, {
                        mm: formatDecimal(p.thicknessMm, 1),
                      })}
                    </p>
                    <p className="tabular-nums text-primary">
                      {t(`${QA}.chartTooltipLineUtil`, {
                        pct: formatDecimal(p.utilizationPct, 1),
                      })}
                    </p>
                    <p className="tabular-nums text-destructive">
                      {t(`${QA}.chartTooltipLineWaste`, {
                        pct: formatDecimal(p.wastePct, 1),
                      })}
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="utilizationPct"
              stackId="full"
              name={utilName}
              fill={CHART_UTIL}
              radius={[0, 0, 6, 6]}
              barSize={BAR_WIDTH_PX}
              activeBar={false}
            >
              <LabelList
                dataKey="utilizationPct"
                position="center"
                fill="#f4fafb"
                fontSize={BAR_LABEL_FONT}
                fontWeight={600}
                formatter={(label) => {
                  const v = typeof label === "number" ? label : Number(label);
                  if (!Number.isFinite(v) || v < 5) return "";
                  return `${Math.round(v)}%`;
                }}
              />
            </Bar>
            <Bar
              dataKey="wastePct"
              stackId="full"
              name={wasteName}
              fill={CHART_WASTE}
              radius={[6, 6, 0, 0]}
              barSize={BAR_WIDTH_PX}
              activeBar={false}
            >
              <LabelList
                dataKey="wastePct"
                position="center"
                fill="#fceff4"
                fontSize={BAR_LABEL_FONT}
                fontWeight={600}
                formatter={(label) => {
                  const v = typeof label === "number" ? label : Number(label);
                  if (!Number.isFinite(v) || v < 5) return "";
                  return `${Math.round(v)}%`;
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-3 pt-4 sm:gap-5"
        dir="rtl"
      >
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] px-4 py-2">
          <span
            className="h-3 w-8 shrink-0 rounded-md"
            style={{ backgroundColor: CHART_UTIL }}
            aria-hidden
          />
          <span className="text-[11px] font-semibold tracking-wide text-foreground/95">
            {utilName}
          </span>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] px-4 py-2">
          <span
            className="h-3 w-8 shrink-0 rounded-md"
            style={{ backgroundColor: CHART_WASTE }}
            aria-hidden
          />
          <span className="text-[11px] font-semibold tracking-wide text-foreground/95">
            {wasteName}
          </span>
        </div>
      </div>
    </div>
  );
}
