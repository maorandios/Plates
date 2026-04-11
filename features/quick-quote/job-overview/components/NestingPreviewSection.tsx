"use client";

import { useMemo, useState } from "react";
import { rectPackWithPlacements } from "@/lib/quotes/rectPackNesting";
import type { SheetLayout } from "@/lib/quotes/rectPackNesting";
import { t } from "@/lib/i18n";
import type { QuotePartRow, ThicknessStockInput } from "../../types/quickQuote";

const QA = "quote.quantityAnalysis" as const;

interface NestingPreviewSectionProps {
  parts: QuotePartRow[];
  thicknessStock?: ThicknessStockInput[] | null;
}

const PREVIEW_W = 320;

function SheetSvg({ layout }: { layout: SheetLayout }) {
  const { sheetWidthMm, sheetLengthMm, placements, utilizationPct } = layout;
  const scale = PREVIEW_W / sheetWidthMm;
  const svgH = Math.round(sheetLengthMm * scale);
  const strokeW = Math.max(0.8, sheetWidthMm / 400);

  return (
    <svg
      width={PREVIEW_W}
      height={svgH}
      viewBox={`0 0 ${sheetWidthMm} ${sheetLengthMm}`}
      style={{ display: "block" }}
      aria-label={t(`${QA}.nestingSheetAria`, {
        n: layout.sheetIndex + 1,
        pct: utilizationPct.toFixed(1),
      })}
    >
      <rect
        width={sheetWidthMm}
        height={sheetLengthMm}
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
        strokeWidth={strokeW * 1.5}
      />

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

      <text
        x={sheetWidthMm / 2}
        y={sheetLengthMm + sheetLengthMm * 0.06}
        textAnchor="middle"
        fontSize={sheetWidthMm * 0.04}
        fill="currentColor"
        fontFamily="monospace"
      >
        {Math.round(sheetWidthMm)} × {Math.round(sheetLengthMm)} מ״מ
      </text>
    </svg>
  );
}

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

  const plateLabel =
    layout.placements.length === 1
      ? t(`${QA}.nestingPlatesOnSheet`)
      : t(`${QA}.nestingPlatesOnSheetMany`, {
          n: layout.placements.length,
        });

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <div className="flex items-center gap-2 px-1 flex-wrap">
        <span className="text-xs font-medium text-foreground">
          {t(`${QA}.nestingSheet`, { n: layout.sheetIndex + 1 })}
          {layout.totalSheetsForThickness > 1
            ? ` · ${t(`${QA}.nestingSheetOf`, {
                current: layout.sheetIndex + 1,
                total: layout.totalSheetsForThickness,
              })}`
            : ""}
        </span>
        {showThickness && (
          <span className="text-xs text-muted-foreground">
            · {t(`${QA}.nestingThick`, { n: layout.thicknessMm })}
          </span>
        )}
        <span
          className={`ms-auto text-xs font-mono font-semibold ${
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

      <div
        className="rounded-md overflow-hidden border border-border"
        style={{ width: PREVIEW_W }}
      >
        <SheetSvg layout={layout} />
      </div>

      <p className="text-xs text-muted-foreground px-1 text-start">
        {plateLabel} · {t(`${QA}.nestingNetM2`, { n: layout.netAreaM2.toFixed(2) })}
        {isLast ? t(`${QA}.nestingLastSheet`) : ""}
      </p>
    </div>
  );
}

export function NestingPreviewSection({
  parts,
  thicknessStock,
}: NestingPreviewSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => {
    if (!parts.length || !thicknessStock?.length) return null;

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

  const multipleThicknesses =
    new Set(result.layouts.map((l) => l.thicknessMm)).size > 1;

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

  const sheetsSummary =
    totalActualSheets === 1
      ? t(`${QA}.nestingFooterSheetsOne`)
      : t(`${QA}.nestingFooterSheets`, { n: totalActualSheets });

  return (
    <section className="space-y-4" dir="rtl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 text-start min-w-0">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
            {t(`${QA}.nestingTitle`)}
          </h2>
          <p className="text-xs text-muted-foreground max-w-prose leading-relaxed">
            {t(`${QA}.nestingIntro`)}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t(`${QA}.nestingHide`) : t(`${QA}.nestingShow`)}
        </button>
      </div>

      {expanded && (
        <div className="space-y-6">
          {thicknessEntries.map(([thicknessMm, layouts]) => (
            <div key={thicknessMm} className="space-y-3">
              {multipleThicknesses && (
                <p className="text-xs font-medium text-muted-foreground tracking-wide text-start">
                  {t(`${QA}.nestingThicknessLine`, {
                    mm: thicknessMm,
                    sheets: layouts[0].totalSheetsForThickness,
                  })}
                </p>
              )}

              <div
                className="flex gap-4 overflow-x-auto pb-2 flex-row-reverse"
                style={{ scrollbarWidth: "thin" }}
              >
                {layouts.map((layout) => (
                  <SheetCard
                    key={`${layout.thicknessMm}-${layout.sheetIndex}`}
                    layout={layout}
                    showThickness={!multipleThicknesses}
                  />
                ))}

                {layouts[0].totalSheetsForThickness > layouts.length && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <div className="h-5" />
                    <div
                      className="rounded-md border border-dashed border-border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground font-medium px-2 text-center leading-snug"
                      style={{
                        width: PREVIEW_W,
                        height: Math.round(
                          (PREVIEW_W * layouts[0].sheetLengthMm) /
                            layouts[0].sheetWidthMm
                        ),
                      }}
                    >
                      {t(`${QA}.nestingMoreSheets`, {
                        n:
                          layouts[0].totalSheetsForThickness - layouts.length,
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="rounded-md bg-muted/50 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground text-start justify-end">
            <span>
              <span className="font-medium text-foreground">{sheetsSummary}</span>
              {hiddenSheets > 0
                ? t(`${QA}.nestingFooterNotPreviewed`, { n: hiddenSheets })
                : ""}
            </span>
            <span>
              <span className="font-medium text-foreground">
                {result.summary.totalSheetAreaM2.toFixed(2)} {t(`${QA}.unitM2`)}
              </span>{" "}
              {t(`${QA}.nestingFooterGross`)}
            </span>
            <span>
              <span className="font-medium text-foreground">
                {result.summary.totalWasteAreaM2.toFixed(2)} {t(`${QA}.unitM2`)}
              </span>{" "}
              {t(`${QA}.nestingFooterWaste`)}
            </span>
            <span>
              <span className="font-medium text-foreground">
                {result.summary.utilizationPct.toFixed(1)}%
              </span>{" "}
              {t(`${QA}.nestingFooterUtil`)}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
