"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { rectPackWithPlacements } from "@/lib/quotes/rectPackNesting";
import type { SheetLayout } from "@/lib/quotes/rectPackNesting";
import { t } from "@/lib/i18n";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuotePartRow, ThicknessStockInput } from "../../types/quickQuote";

const QA = "quote.quantityAnalysis" as const;

interface NestingPreviewSectionProps {
  parts: QuotePartRow[];
  thicknessStock?: ThicknessStockInput[] | null;
}

function SheetSvg({ layout }: { layout: SheetLayout }) {
  const { sheetWidthMm, sheetLengthMm, placements, utilizationPct } = layout;
  const w = sheetWidthMm;
  const h = sheetLengthMm;
  /** Long edge horizontal: map packing coords (w×h) into viewBox (h×w) without CSS rotate. */
  const rotateToLandscape = h > w;
  const longSide = Math.max(w, h);
  const shortSide = Math.min(w, h);
  const strokeW = Math.max(0.8, longSide / 400);

  /** x' = h − y, y' = x — aligns bin [0,w]×[0,h] exactly with viewBox [0,h]×[0,w] (translate/rotate/translate was off-by-quadrant and clipped). */
  const sheetGroupTransform = rotateToLandscape
    ? `matrix(0, 1, -1, 0, ${h}, 0)`
    : undefined;

  return (
    <div className="relative min-h-[260px] w-full min-w-0 flex-1 self-stretch">
      <svg
        className="block h-full w-full min-h-[220px] overflow-visible"
        viewBox={`0 0 ${longSide} ${shortSide}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label={t(`${QA}.nestingSheetAria`, {
          n: layout.sheetIndex + 1,
          pct: utilizationPct.toFixed(1),
        })}
      >
        <g transform={sheetGroupTransform}>
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
              rx={w * 0.003}
            />
          ))}

          <rect
            width={w}
            height={h}
            fill="none"
            stroke="hsl(var(--primary) / 0.62)"
            strokeWidth={strokeW}
            pointerEvents="none"
            aria-hidden
          />
        </g>
      </svg>
    </div>
  );
}

function SheetCard({
  layout,
  showThickness,
}: {
  layout: SheetLayout;
  showThickness: boolean;
}) {
  const grossM2 =
    (layout.sheetWidthMm * layout.sheetLengthMm) / 1_000_000;
  const wasteM2 = Math.max(0, grossM2 - layout.netAreaM2);
  const plateCount = layout.placements.length;

  const title =
    t(`${QA}.nestingSheet`, { n: layout.sheetIndex + 1 }) +
    (layout.totalSheetsForThickness > 1
      ? ` · ${t(`${QA}.nestingSheetOf`, {
          current: layout.sheetIndex + 1,
          total: layout.totalSheetsForThickness,
        })}`
      : "");

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-card/60 shadow-sm"
      dir="rtl"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.06] px-3 pb-2.5 pt-3">
        <div className="min-w-0 space-y-0.5 text-start">
          <p className="text-sm font-semibold leading-tight text-foreground">
            {title}
          </p>
          {showThickness && (
            <p className="text-[11px] text-muted-foreground">
              {t(`${QA}.nestingThick`, { n: layout.thicknessMm })}
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md bg-black/20 px-2 py-0.5 text-sm font-mono font-bold tabular-nums",
            layout.utilizationPct >= 68
              ? "text-green-400"
              : layout.utilizationPct >= 48
                ? "text-yellow-400"
                : "text-red-400"
          )}
        >
          {layout.utilizationPct.toFixed(1)}%
        </span>
      </div>

      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-3 pt-2.5 pb-2">
        <SheetSvg layout={layout} />
      </div>

      <div className="mx-3.5 mb-4 mt-1 border-t border-white/[0.07] pt-4 sm:mx-4 sm:mb-5">
        <div
          className={cn(
            "overflow-hidden rounded-lg border border-white/[0.09] bg-muted/25 text-[13.75px] leading-snug text-muted-foreground shadow-[inset_0_1px_0_0_hsl(0_0%_100%/_0.04)]",
            "flex flex-col divide-y divide-white/[0.12]",
            "sm:flex-row sm:divide-x sm:divide-y-0 sm:divide-white/[0.12]"
          )}
        >
          <div className="min-w-0 flex-1 px-4 py-3.5 text-center sm:px-5">
            <span className="font-medium text-foreground/90">
              {t(`${QA}.nestingMetaDims`)}{" "}
            </span>
            {Math.round(layout.sheetWidthMm)} × {Math.round(layout.sheetLengthMm)}{" "}
            {t(`${QA}.unitMm`)}
          </div>
          <div className="min-w-0 flex-1 px-4 py-3.5 text-center sm:px-5">
            <span className="font-medium text-foreground/90">
              {t(`${QA}.nestingSheetCardPlates`)}{" "}
            </span>
            {plateCount}
          </div>
          <div className="min-w-0 flex-1 px-4 py-3.5 text-center sm:px-5">
            <span className="font-medium text-foreground/90">
              {t(`${QA}.nestingSheetCardUsage`)}{" "}
            </span>
            {layout.netAreaM2.toFixed(2)} {t(`${QA}.unitM2`)}
          </div>
          <div className="min-w-0 flex-1 px-4 py-3.5 text-center sm:px-5">
            <span className="font-medium text-foreground/90">
              {t(`${QA}.nestingSheetCardWaste`)}{" "}
            </span>
            {wasteM2.toFixed(2)} {t(`${QA}.unitM2`)}
          </div>
        </div>
      </div>
    </div>
  );
}

type GridCell =
  | { kind: "sheet"; layout: SheetLayout }
  | { kind: "more"; extraCount: number };

function buildGridCells(layouts: SheetLayout[]): GridCell[] {
  if (layouts.length === 0) return [];
  const first = layouts[0];
  const items: GridCell[] = layouts.map((layout) => ({
    kind: "sheet" as const,
    layout,
  }));
  if (first.totalSheetsForThickness > layouts.length) {
    items.push({
      kind: "more",
      extraCount: first.totalSheetsForThickness - layouts.length,
    });
  }
  return items;
}

function MoreSheetsGridCell({ extraCount }: { extraCount: number }) {
  return (
    <div
      className="flex min-h-[200px] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-muted/25 px-4 py-6 text-center shadow-sm"
      dir="rtl"
    >
      <p className="text-sm font-medium leading-relaxed text-muted-foreground">
        {t(`${QA}.nestingMoreSheets`, { n: extraCount })}
      </p>
    </div>
  );
}

function GridCellView({
  cell,
  showThickness,
}: {
  cell: GridCell;
  showThickness: boolean;
}) {
  if (cell.kind === "sheet") {
    return (
      <div className="h-full min-w-0">
        <SheetCard layout={cell.layout} showThickness={showThickness} />
      </div>
    );
  }
  if (cell.kind === "more") {
    return <MoreSheetsGridCell extraCount={cell.extraCount} />;
  }
  return null;
}

/** All sheets in two columns, new rows as needed — no horizontal scroll. */
function SheetsTwoColumnGrid({
  layouts,
  showThickness,
}: {
  layouts: SheetLayout[];
  showThickness: boolean;
}) {
  const cells = useMemo(() => buildGridCells(layouts), [layouts]);

  return (
    <div
      className="grid w-full grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-5"
      dir="rtl"
    >
      {cells.map((cell, i) => (
        <GridCellView
          key={
            cell.kind === "sheet"
              ? `${cell.layout.thicknessMm}-${cell.layout.sheetIndex}-${i}`
              : `more-${i}`
          }
          cell={cell}
          showThickness={showThickness}
        />
      ))}
    </div>
  );
}

export function NestingPreviewSection({
  parts,
  thicknessStock,
}: NestingPreviewSectionProps) {
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

  const [expandedByTh, setExpandedByTh] = useState<Record<number, boolean>>({});

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

  const isOpen = (th: number) => Boolean(expandedByTh[th]);

  return (
    <section className="space-y-4" dir="rtl">
      <div className="space-y-1 text-start">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
          {t(`${QA}.nestingTitle`)}
        </h2>
        <p className="text-sm text-muted-foreground max-w-prose leading-relaxed">
          {t(`${QA}.nestingIntro`)}
        </p>
      </div>

      <div className="space-y-3">
        {thicknessEntries.map(([thicknessMm, layouts]) => {
          const open = isOpen(thicknessMm);
          return (
            <Card
              key={thicknessMm}
              className={cn(
                "overflow-hidden border bg-card/80 shadow-sm transition-colors",
                "border-white/10",
                open && "border-emerald-500/25 bg-emerald-500/[0.04]"
              )}
            >
              <CardHeader className="cursor-pointer select-none space-y-0 p-4 pb-3 sm:p-5">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-start"
                  onClick={() =>
                    setExpandedByTh((prev) => ({
                      ...prev,
                      [thicknessMm]: !isOpen(thicknessMm),
                    }))
                  }
                  aria-expanded={open}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      open ? "rotate-0" : "-rotate-90"
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {t(`${QA}.nestingThicknessLine`, {
                        mm: thicknessMm,
                        sheets: layouts[0].totalSheetsForThickness,
                      })}
                    </p>
                  </div>
                </button>
              </CardHeader>

              {open && (
                <CardContent className="border-t border-white/10 bg-card/40 px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
                  <SheetsTwoColumnGrid
                    layouts={layouts}
                    showThickness={!multipleThicknesses}
                  />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
