"use client";

import { useMemo, useState } from "react";
import { rectPackWithPlacements } from "@/lib/quotes/rectPackNesting";
import type { SheetLayout } from "@/lib/quotes/rectPackNesting";
import type { QuotePartRow, ThicknessStockInput } from "../../types/quickQuote";

interface NestingPreviewSectionProps {
  parts: QuotePartRow[];
  thicknessStock?: ThicknessStockInput[] | null;
}

// ---------------------------------------------------------------------------
// Single sheet SVG
// ---------------------------------------------------------------------------

const PREVIEW_W = 320; // px — fixed display width per sheet thumbnail

function SheetSvg({ layout }: { layout: SheetLayout }) {
  const { sheetWidthMm, sheetLengthMm, placements, utilizationPct } = layout;
  const scale = PREVIEW_W / sheetWidthMm;
  const svgH = Math.round(sheetLengthMm * scale);
  // stroke width scales with sheet so it always reads cleanly
  const strokeW = Math.max(0.8, sheetWidthMm / 400);

  return (
    <svg
      width={PREVIEW_W}
      height={svgH}
      viewBox={`0 0 ${sheetWidthMm} ${sheetLengthMm}`}
      style={{ display: "block" }}
      aria-label={`Sheet ${layout.sheetIndex + 1} — ${utilizationPct}% utilization`}
    >
      {/* Sheet background */}
      <rect
        width={sheetWidthMm}
        height={sheetLengthMm}
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
        strokeWidth={strokeW * 1.5}
      />

      {/* Grid lines (faint) */}
      {[0.25, 0.5, 0.75].map((f) => (
        <g key={f}>
          <line
            x1={sheetWidthMm * f}
            y1={0}
            x2={sheetWidthMm * f}
            y2={sheetLengthMm}
            stroke="hsl(var(--border))"
            strokeWidth={strokeW * 0.4}
            strokeDasharray={`${sheetWidthMm * 0.02} ${sheetWidthMm * 0.02}`}
          />
          <line
            x1={0}
            y1={sheetLengthMm * f}
            x2={sheetWidthMm}
            y2={sheetLengthMm * f}
            stroke="hsl(var(--border))"
            strokeWidth={strokeW * 0.4}
            strokeDasharray={`${sheetWidthMm * 0.02} ${sheetWidthMm * 0.02}`}
          />
        </g>
      ))}

      {/* Placed parts */}
      {placements.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          fill="hsl(var(--primary) / 0.18)"
          stroke="hsl(var(--primary) / 0.7)"
          strokeWidth={strokeW}
          rx={sheetWidthMm * 0.003}
        />
      ))}

      {/* Dimension labels (mm) */}
      <text
        x={sheetWidthMm / 2}
        y={sheetLengthMm + sheetLengthMm * 0.06}
        textAnchor="middle"
        fontSize={sheetWidthMm * 0.04}
        fill="currentColor"
        fontFamily="monospace"
      >
        {Math.round(sheetWidthMm)} × {Math.round(sheetLengthMm)} mm
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sheet card with label + caption
// ---------------------------------------------------------------------------

function SheetCard({
  layout,
  showThickness,
}: {
  layout: SheetLayout;
  showThickness: boolean;
}) {
  const isLast =
    layout.sheetIndex === layout.totalSheetsForThickness - 1 &&
    layout.totalSheetsForThickness > 1;

  return (
    <div className="flex flex-col gap-2 shrink-0">
      {/* Label row */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-medium text-foreground">
          Sheet {layout.sheetIndex + 1}
          {layout.totalSheetsForThickness > 1
            ? ` / ${layout.totalSheetsForThickness}`
            : ""}
        </span>
        {showThickness && (
          <span className="text-xs text-muted-foreground">
            · {layout.thicknessMm} mm thick
          </span>
        )}
        <span
          className={`ml-auto text-xs font-mono font-semibold ${
            layout.utilizationPct >= 68
              ? "text-green-600 dark:text-green-400"
              : layout.utilizationPct >= 48
              ? "text-yellow-600 dark:text-yellow-400"
              : "text-red-500 dark:text-red-400"
          }`}
        >
          {layout.utilizationPct.toFixed(1)}%
        </span>
      </div>

      {/* SVG sheet */}
      <div
        className="rounded-md overflow-hidden border border-border"
        style={{ width: PREVIEW_W }}
      >
        <SheetSvg layout={layout} />
      </div>

      {/* Caption */}
      <p className="text-xs text-muted-foreground px-1">
        {layout.placements.length} plate
        {layout.placements.length !== 1 ? "s" : ""} ·{" "}
        {layout.netAreaM2.toFixed(2)} m² net
        {isLast && " · last sheet"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function NestingPreviewSection({
  parts,
  thicknessStock,
}: NestingPreviewSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => {
    if (!parts.length || !thicknessStock?.length) return null;

    // Collect all unique sheet sizes
    const sizeMap = new Map<
      string,
      { sheetWidthMm: number; sheetLengthMm: number }
    >();
    for (const row of thicknessStock) {
      for (const s of row.sheets) {
        if (s.sheetLengthMm > 0 && s.sheetWidthMm > 0) {
          const key = `${s.sheetWidthMm}x${s.sheetLengthMm}`;
          if (!sizeMap.has(key)) {
            sizeMap.set(key, {
              sheetWidthMm: s.sheetWidthMm,
              sheetLengthMm: s.sheetLengthMm,
            });
          }
        }
      }
    }

    const stockLines = [...sizeMap.values()];
    if (stockLines.length === 0) return null;

    const packParts = parts.map((p) => ({
      thicknessMm: p.thicknessMm,
      widthMm: p.widthMm,
      lengthMm: p.lengthMm,
      areaM2: p.areaM2,
      qty: p.qty,
    }));

    return rectPackWithPlacements(packParts, stockLines, 0, 3);
  }, [parts, thicknessStock]);

  if (!result || result.layouts.length === 0) return null;

  const multipleThicknesses = new Set(result.layouts.map((l) => l.thicknessMm)).size > 1;

  // Group layouts by thickness for display
  const grouped = new Map<number, SheetLayout[]>();
  for (const layout of result.layouts) {
    const th = layout.thicknessMm;
    const existing = grouped.get(th);
    if (existing) existing.push(layout);
    else grouped.set(th, [layout]);
  }

  const thicknessEntries = [...grouped.entries()].sort(([a], [b]) => a - b);
  const totalDisplaySheets = result.layouts.length;
  const totalActualSheets = result.summary.estimatedSheetCount;
  const hiddenSheets = totalActualSheets - totalDisplaySheets;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Nesting layout
          </h2>
          <p className="text-xs text-muted-foreground max-w-prose">
            Bounding-box nest estimate — parts sorted and rotated (0°/90°)
            automatically, 0 mm gap between plates and sheet edges. Showing up to 3 sheets
            per thickness.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide" : "Show"} layout
        </button>
      </div>

      {expanded && (
        <div className="space-y-6">
          {thicknessEntries.map(([thicknessMm, layouts]) => (
            <div key={thicknessMm} className="space-y-3">
              {multipleThicknesses && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {thicknessMm} mm thick ·{" "}
                  {layouts[0].totalSheetsForThickness} sheet
                  {layouts[0].totalSheetsForThickness !== 1 ? "s" : ""} total
                </p>
              )}

              {/* Horizontally scrollable sheet row */}
              <div
                className="flex gap-4 overflow-x-auto pb-2"
                style={{ scrollbarWidth: "thin" }}
              >
                {layouts.map((layout) => (
                  <SheetCard
                    key={`${layout.thicknessMm}-${layout.sheetIndex}`}
                    layout={layout}
                    showThickness={!multipleThicknesses}
                  />
                ))}

                {/* "More sheets" placeholder */}
                {layouts[0].totalSheetsForThickness > layouts.length && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <div className="h-5" />
                    <div
                      className="rounded-md border border-dashed border-border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground font-medium"
                      style={{ width: PREVIEW_W, height: Math.round((PREVIEW_W * layouts[0].sheetLengthMm) / layouts[0].sheetWidthMm) }}
                    >
                      +{layouts[0].totalSheetsForThickness - layouts.length} more sheet
                      {layouts[0].totalSheetsForThickness - layouts.length !== 1 ? "s" : ""}{" "}
                      at same layout
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Summary footer */}
          <div className="rounded-md bg-muted/50 border border-border px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">
                {totalActualSheets}
              </span>{" "}
              total sheet{totalActualSheets !== 1 ? "s" : ""}
              {hiddenSheets > 0 && ` (${hiddenSheets} not previewed)`}
            </span>
            <span>
              <span className="font-medium text-foreground">
                {result.summary.totalSheetAreaM2.toFixed(2)} m²
              </span>{" "}
              gross material
            </span>
            <span>
              <span className="font-medium text-foreground">
                {result.summary.totalWasteAreaM2.toFixed(2)} m²
              </span>{" "}
              waste (offcuts)
            </span>
            <span>
              <span className="font-medium text-foreground">
                {result.summary.utilizationPct.toFixed(1)}%
              </span>{" "}
              overall utilization
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
