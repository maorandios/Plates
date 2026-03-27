"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { formatAreaM2 } from "../../job-overview/jobOverview.utils";
import { InsightStatCard } from "./InsightStatCard";
import type { ManufacturingParameters } from "../../types/quickQuote";
import {
  SHEET_SENSITIVITY_UTIL_MAX,
  SHEET_SENSITIVITY_UTIL_MIN,
  buildSheetSensitivitySeries,
  clampSheetSensitivityUtil,
  materialAndSheetsForUtilization,
  referenceSheetAreaM2,
  safeNumber,
} from "../quoteInsights.utils";

interface SheetCountSensitivityPanelProps {
  mfgParams: ManufacturingParameters;
}

export function SheetCountSensitivityPanel({ mfgParams }: SheetCountSensitivityPanelProps) {
  const totalNetPlateAreaM2 = useMemo(
    () => Math.max(0, safeNumber(mfgParams.totalNetPlateAreaM2)),
    [mfgParams.totalNetPlateAreaM2]
  );
  const stockSheetAreaM2 = useMemo(
    () => referenceSheetAreaM2(mfgParams),
    [
      mfgParams.totalSheetAreaM2,
      mfgParams.estimatedSheetCount,
    ]
  );

  const quoteUtil = useMemo(
    () => clampSheetSensitivityUtil(mfgParams.utilizationPct),
    [mfgParams.utilizationPct]
  );
  const [utilPct, setUtilPct] = useState(quoteUtil);
  useEffect(() => {
    setUtilPct(quoteUtil);
  }, [quoteUtil]);

  const chartData = useMemo(
    () =>
      buildSheetSensitivitySeries(totalNetPlateAreaM2, stockSheetAreaM2).map((p) => ({
        utilizationPct: p.utilizationPct,
        sheetCount: p.sheetCount,
      })),
    [totalNetPlateAreaM2, stockSheetAreaM2]
  );

  const live = useMemo(
    () =>
      materialAndSheetsForUtilization(
        totalNetPlateAreaM2,
        stockSheetAreaM2,
        utilPct
      ),
    [totalNetPlateAreaM2, stockSheetAreaM2, utilPct]
  );

  function applyUtil(next: number) {
    const n = safeNumber(next, utilPct);
    const stepped = Number.isFinite(n) ? Math.round(n) : utilPct;
    setUtilPct(clampSheetSensitivityUtil(stepped));
  }

  const id = "quote-insights-sheet-util";

  return (
    <div className="flex flex-col flex-1 gap-4 min-h-0 min-w-0">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide min-h-[1.25rem] leading-none">
        Sheet count sensitivity
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0 auto-rows-fr">
        <InsightStatCard
          label="Estimated sheets"
          value={String(live.sheetCount)}
        />
        <InsightStatCard
          label="Material area required"
          value={formatAreaM2(live.requiredMaterialAreaM2)}
        />
        <InsightStatCard
          label="Net plate area"
          value={formatAreaM2(totalNetPlateAreaM2)}
        />
      </div>

      <div className="min-w-0 pt-1 border-b border-border/60 pb-4 shrink-0">
        <div className="space-y-4 min-w-0">
          <div className="space-y-1 min-w-0 text-left">
            <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Utilization %
            </Label>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {utilPct}
              <span className="text-lg font-medium text-muted-foreground ml-0.5">%</span>
            </p>
          </div>
          <div className="space-y-2">
            <input
              id={id}
              type="range"
              min={SHEET_SENSITIVITY_UTIL_MIN}
              max={SHEET_SENSITIVITY_UTIL_MAX}
              step={1}
              value={utilPct}
              onChange={(e) => applyUtil(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-foreground"
              aria-valuemin={SHEET_SENSITIVITY_UTIL_MIN}
              aria-valuemax={SHEET_SENSITIVITY_UTIL_MAX}
              aria-valuenow={utilPct}
              aria-label="Adjust utilization percent"
            />
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
              <span>{SHEET_SENSITIVITY_UTIL_MIN}%</span>
              <span>{SHEET_SENSITIVITY_UTIL_MAX}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex flex-col flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
          Sheet impact by utilization
        </p>
        <div className="mt-2 flex-1 min-h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              type="number"
              dataKey="utilizationPct"
              domain={[SHEET_SENSITIVITY_UTIL_MIN, SHEET_SENSITIVITY_UTIL_MAX]}
              ticks={[50, 60, 70, 80, 90]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              label={{
                value: "Utilization %",
                position: "insideBottom",
                offset: -2,
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              width={40}
              label={{
                value: "Sheets",
                angle: -90,
                position: "insideLeft",
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as {
                  utilizationPct: number;
                  sheetCount: number;
                };
                const m = materialAndSheetsForUtilization(
                  totalNetPlateAreaM2,
                  stockSheetAreaM2,
                  p.utilizationPct
                );
                return (
                  <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-medium text-foreground tabular-nums">
                      {p.utilizationPct}% utilization
                    </p>
                    <p className="text-muted-foreground mt-1 tabular-nums">
                      Sheets: {p.sheetCount}
                    </p>
                    <p className="text-muted-foreground mt-0.5 tabular-nums">
                      Material: {formatAreaM2(m.requiredMaterialAreaM2)}
                    </p>
                  </div>
                );
              }}
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "4 4" }}
            />
            <Line
              type="monotone"
              dataKey="sheetCount"
              name="Sheet count"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: "hsl(var(--foreground))" }}
            />
            <ReferenceDot
              x={utilPct}
              y={live.sheetCount}
              r={6}
              fill="hsl(var(--foreground))"
              stroke="hsl(var(--background))"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
