"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import {
  compareRectPackGroupKeys,
  rectPackWithPlacements,
} from "@/lib/quotes/rectPackNesting";
import type {
  RectPackResult,
  SheetLayout,
} from "@/lib/quotes/rectPackNesting";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { QuotePartRow, ThicknessStockInput } from "../../types/quickQuote";
import {
  displayNestingMaterialGradeKey,
  nestingMaterialGradeKey,
} from "../../lib/plateFields";

const QA = "quote.quantityAnalysis" as const;

/** # and צפיה stay narrow; remaining columns share the rest evenly. */
const NESTING_TABLE_COL_WIDTHS_PCT = (() => {
  const indexAndViewPct = 3 + 3.5;
  const mid = (100 - indexAndViewPct) / 7;
  return [3, mid, mid, mid, mid, mid, mid, mid, 3.5] as const;
})();

function partsInNestingGroup(
  parts: QuotePartRow[],
  thicknessMm: number,
  corrugated: boolean,
  materialGradeKey: string
): QuotePartRow[] {
  return parts.filter(
    (p) =>
      p.thicknessMm === thicknessMm &&
      (p.corrugated === true) === corrugated &&
      nestingMaterialGradeKey(p.material) === materialGradeKey
  );
}

function thicknessResultForGroup(
  summary: RectPackResult,
  thicknessMm: number,
  corrugated: boolean,
  materialGradeKey: string
) {
  return summary.perThickness.find(
    (r) =>
      r.thicknessMm === thicknessMm &&
      r.corrugated === corrugated &&
      r.materialGradeKey === materialGradeKey
  );
}

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
  const utilPctSheet = layout.utilizationPct;
  const wastePctSheet =
    grossM2 > 0 ? Math.round((wasteM2 / grossM2) * 1000) / 10 : 0;

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
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card/60 shadow-sm"
      dir="rtl"
    >
      <div className="flex flex-wrap items-start gap-2 border-b border-border px-3 pb-2.5 pt-3">
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
      </div>

      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-3 pt-2.5 pb-2">
        <SheetSvg layout={layout} />
      </div>

      <div className="mx-3.5 mb-4 mt-1 border-t border-border pt-4 sm:mx-4 sm:mb-5">
        <div
          className={cn(
            "overflow-hidden rounded-lg border border-border bg-muted/25 text-[13.75px] leading-snug text-muted-foreground shadow-[inset_0_1px_0_0_hsl(0_0%_100%/_0.04)]",
            "flex flex-col divide-y divide-border",
            "sm:flex-row sm:divide-x sm:divide-y-0 sm:divide-border"
          )}
        >
          <div className="min-w-0 flex-1 px-4 py-3.5 text-center sm:px-5">
            <span className="font-medium text-foreground/90">
              {t(`${QA}.nestingSheetCardPlates`)}{" "}
            </span>
            {plateCount}
          </div>
          <div className="min-w-0 flex-1 px-3 py-3.5 text-center sm:px-4">
            <span className="font-medium text-foreground/90">
              {t(`${QA}.nestingSheetCardUsage`)}{" "}
            </span>
            {layout.netAreaM2.toFixed(2)} {t(`${QA}.unitM2`)}{" "}
            <span
              className={cn(
                "ms-1 inline-flex align-middle rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#14765F]",
                "dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-[#14765F]"
              )}
            >
              {utilPctSheet.toFixed(1)}%
            </span>
          </div>
          <div className="min-w-0 flex-1 px-3 py-3.5 text-center sm:px-4">
            <span className="font-medium text-foreground/90">
              {t(`${QA}.nestingSheetCardWaste`)}{" "}
            </span>
            {wasteM2.toFixed(2)} {t(`${QA}.unitM2`)}{" "}
            <span
              className={cn(
                "ms-1 inline-flex align-middle rounded-full border border-orange-500/40 bg-orange-500/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#FF4C00]",
                "dark:border-orange-500/35 dark:bg-orange-500/18 dark:text-[#FF4C00]"
              )}
            >
              {wastePctSheet.toFixed(1)}%
            </span>
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
      className="flex min-h-[200px] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/25 px-4 py-6 text-center shadow-sm"
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

/** Sheets grid: two columns on wide screens by default; modal uses one column full width. */
function SheetsTwoColumnGrid({
  layouts,
  showThickness,
  singleColumnFullWidth = false,
}: {
  layouts: SheetLayout[];
  showThickness: boolean;
  /** When true (e.g. modal), each sheet preview spans the full container width. */
  singleColumnFullWidth?: boolean;
}) {
  const cells = useMemo(() => buildGridCells(layouts), [layouts]);

  return (
    <div
      className={cn(
        "grid w-full min-w-0 items-stretch gap-4",
        singleColumnFullWidth
          ? "grid-cols-1"
          : "grid-cols-1 sm:grid-cols-2 sm:gap-5"
      )}
      dir="rtl"
    >
      {cells.map((cell, i) => (
        <GridCellView
          key={
            cell.kind === "sheet"
              ? `${cell.layout.thicknessMm}-${cell.layout.corrugated ? "c" : "p"}-${cell.layout.materialGradeKey}-${cell.layout.sheetIndex}-${i}`
              : `more-${i}`
          }
          cell={cell}
          showThickness={showThickness}
        />
      ))}
    </div>
  );
}

type NestingGroup = { key: string; layouts: SheetLayout[] };

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
      corrugated: p.corrugated === true,
      materialGradeKey: nestingMaterialGradeKey(p.material),
    }));

    return rectPackWithPlacements(packParts, stockLines, 0, 3);
  }, [parts, thicknessStock]);

  const [modalGroupKey, setModalGroupKey] = useState<string | null>(null);
  const [filterSheetSize, setFilterSheetSize] = useState("all");
  const [filterThickness, setFilterThickness] = useState("all");
  const [filterSteel, setFilterSteel] = useState("all");
  const [filterCorrugated, setFilterCorrugated] = useState("all");

  const groups: NestingGroup[] = useMemo(() => {
    if (!result?.layouts.length) return [];
    const m = new Map<string, SheetLayout[]>();
    for (const layout of result.layouts) {
      const gk = `${layout.thicknessMm}\u0000${layout.corrugated ? "1" : "0"}\u0000${layout.materialGradeKey}`;
      const existing = m.get(gk);
      if (existing) existing.push(layout);
      else m.set(gk, [layout]);
    }
    return [...m.entries()]
      .sort(([a], [b]) => compareRectPackGroupKeys(a, b))
      .map(([key, layouts]) => ({ key, layouts }));
  }, [result]);

  const nestingFilterOptions = useMemo(() => {
    const sizes: { key: string; label: string }[] = [];
    const sizeSeen = new Set<string>();
    const thicknessSet = new Set<string>();
    const steelSet = new Set<string>();
    for (const g of groups) {
      const f = g.layouts[0];
      const w = Math.round(f.sheetWidthMm);
      const l = Math.round(f.sheetLengthMm);
      const sk = `${w}x${l}`;
      if (!sizeSeen.has(sk)) {
        sizeSeen.add(sk);
        sizes.push({
          key: sk,
          label: `${w} × ${l} ${t(`${QA}.unitMm`)}`,
        });
      }
      thicknessSet.add(String(Math.round(f.thicknessMm * 100) / 100));
      steelSet.add(displayNestingMaterialGradeKey(f.materialGradeKey));
    }
    sizes.sort((a, b) => {
      const [aw, al] = a.key.split("x").map(Number);
      const [bw, bl] = b.key.split("x").map(Number);
      return bw * bl - aw * al;
    });
    const thicknesses = [...thicknessSet].sort(
      (a, b) => Number(a) - Number(b)
    );
    const steels = [...steelSet].sort();
    return { sizes, thicknesses, steels };
  }, [groups, parts]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const f = g.layouts[0];
      const w = Math.round(f.sheetWidthMm);
      const l = Math.round(f.sheetLengthMm);
      if (filterSheetSize !== "all" && `${w}x${l}` !== filterSheetSize) {
        return false;
      }
      const mmRounded = Math.round(f.thicknessMm * 100) / 100;
      if (filterThickness !== "all" && String(mmRounded) !== filterThickness) {
        return false;
      }
      if (filterCorrugated === "yes" && !f.corrugated) return false;
      if (filterCorrugated === "no" && f.corrugated) return false;
      if (filterSteel !== "all") {
        const label = displayNestingMaterialGradeKey(f.materialGradeKey);
        if (label !== filterSteel) return false;
      }
      return true;
    });
  }, [
    groups,
    parts,
    filterSheetSize,
    filterThickness,
    filterSteel,
    filterCorrugated,
  ]);

  const modalGroup = modalGroupKey
    ? filteredGroups.find((g) => g.key === modalGroupKey) ?? null
    : null;

  const modalSubtitle =
    modalGroup != null
      ? t(
          modalGroup.layouts[0].corrugated
            ? `${QA}.nestingModalSubtitleCheckered`
            : `${QA}.nestingModalSubtitle`,
          {
            mm: Math.round(modalGroup.layouts[0].thicknessMm * 100) / 100,
            width: Math.round(modalGroup.layouts[0].sheetWidthMm),
            length: Math.round(modalGroup.layouts[0].sheetLengthMm),
          }
        )
      : "";

  useEffect(() => {
    if (!modalGroupKey) return;
    if (!filteredGroups.some((g) => g.key === modalGroupKey)) {
      setModalGroupKey(null);
    }
  }, [filteredGroups, modalGroupKey]);

  if (!result || result.layouts.length === 0) return null;

  const multipleThicknesses =
    new Set(result.layouts.map((l) => l.thicknessMm)).size > 1;

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

      <div
        className="grid w-full grid-cols-1 gap-3 rounded-xl border border-border bg-card/40 p-4 sm:grid-cols-2 lg:grid-cols-4"
        role="search"
        aria-label={t(`${QA}.nestingFilterSectionAria`)}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="nesting-filter-sheet" className="text-muted-foreground">
            {t(`${QA}.nestingFilterSheetSizeLabel`)}
          </Label>
          <Select value={filterSheetSize} onValueChange={setFilterSheetSize}>
            <SelectTrigger id="nesting-filter-sheet" className="w-full">
              <SelectValue placeholder={t(`${QA}.nestingFilterAll`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t(`${QA}.nestingFilterAll`)}</SelectItem>
              {nestingFilterOptions.sizes.map(({ key, label }) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="nesting-filter-thickness" className="text-muted-foreground">
            {t(`${QA}.nestingFilterThicknessLabel`)}
          </Label>
          <Select value={filterThickness} onValueChange={setFilterThickness}>
            <SelectTrigger id="nesting-filter-thickness" className="w-full">
              <SelectValue placeholder={t(`${QA}.nestingFilterAll`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t(`${QA}.nestingFilterAll`)}</SelectItem>
              {nestingFilterOptions.thicknesses.map((th) => (
                <SelectItem key={th} value={th}>
                  {t(`${QA}.nestingSummaryValueThicknessMm`, {
                    mm: Number(th),
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="nesting-filter-steel" className="text-muted-foreground">
            {t(`${QA}.nestingFilterSteelLabel`)}
          </Label>
          <Select value={filterSteel} onValueChange={setFilterSteel}>
            <SelectTrigger id="nesting-filter-steel" className="w-full">
              <SelectValue placeholder={t(`${QA}.nestingFilterAll`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t(`${QA}.nestingFilterAll`)}</SelectItem>
              {nestingFilterOptions.steels.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="nesting-filter-corrugated" className="text-muted-foreground">
            {t(`${QA}.nestingFilterCorrugatedLabel`)}
          </Label>
          <Select value={filterCorrugated} onValueChange={setFilterCorrugated}>
            <SelectTrigger id="nesting-filter-corrugated" className="w-full">
              <SelectValue placeholder={t(`${QA}.nestingFilterAll`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t(`${QA}.nestingFilterAll`)}</SelectItem>
              <SelectItem value="yes">{t("common.yes")}</SelectItem>
              <SelectItem value="no">{t("common.no")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full rounded-xl border border-border bg-card/50 shadow-sm">
        <Table
          className="table-fixed w-full min-w-0"
          containerClassName="w-full min-w-0 overflow-x-auto"
        >
          <colgroup>
            {NESTING_TABLE_COL_WIDTHS_PCT.map((pct, i) => (
              <col key={i} style={{ width: `${pct.toFixed(4)}%` }} />
            ))}
          </colgroup>
          <TableHeader className="border-b border-border bg-muted/20 [&_tr]:border-b-0">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto px-1 py-3 text-center text-sm font-medium whitespace-normal">
                {t(`${QA}.nestingTableColNum`)}
              </TableHead>
              <TableHead className="h-auto px-2 py-3 text-sm whitespace-normal">
                {t(`${QA}.nestingTableColSheetSize`)}
              </TableHead>
              <TableHead className="h-auto px-2 py-3 text-sm whitespace-normal">
                {t(`${QA}.nestingTableColThickness`)}
              </TableHead>
              <TableHead className="h-auto px-2 py-3 text-sm whitespace-normal">
                {t(`${QA}.nestingTableColStockQty`)}
              </TableHead>
              <TableHead className="h-auto px-2 py-3 text-sm whitespace-normal">
                {t(`${QA}.nestingTableColSteelGrade`)}
              </TableHead>
              <TableHead className="h-auto px-2 py-3 text-sm whitespace-normal">
                {t(`${QA}.nestingTableColCorrugated`)}
              </TableHead>
              <TableHead className="h-auto px-2 py-3 text-sm tabular-nums whitespace-normal">
                {t(`${QA}.nestingTableColUtilization`)}
              </TableHead>
              <TableHead className="h-auto px-2 py-3 text-sm tabular-nums whitespace-normal">
                {t(`${QA}.nestingTableColWaste`)}
              </TableHead>
              <TableHead className="h-auto px-1 py-3 text-center text-sm whitespace-normal">
                {t(`${QA}.nestingTableColView`)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {t(`${QA}.nestingFilterEmpty`)}
                </TableCell>
              </TableRow>
            ) : null}
            {filteredGroups.map(({ key, layouts }, index) => {
              const first = layouts[0];
              const thicknessMm = first.thicknessMm;
              const isCorrugated = first.corrugated;
              const gradeKey = first.materialGradeKey;
              const groupParts = partsInNestingGroup(
                parts,
                thicknessMm,
                isCorrugated,
                gradeKey
              );
              const thResult = thicknessResultForGroup(
                result.summary,
                thicknessMm,
                isCorrugated,
                gradeKey
              );
              const grossM2 =
                thResult != null
                  ? thResult.sheetCount * thResult.sheetAreaM2
                  : 0;
              const utilPct = thResult?.utilizationPct ?? 0;
              const wastePct =
                grossM2 > 0 && thResult != null
                  ? (thResult.wasteAreaM2 / grossM2) * 100
                  : 0;
              const w = Math.round(first.sheetWidthMm);
              const l = Math.round(first.sheetLengthMm);
              const mmRounded = Math.round(thicknessMm * 100) / 100;

              return (
                <TableRow key={key}>
                  <TableCell className="min-w-0 px-1 py-2.5 align-middle text-center text-sm tabular-nums text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="min-w-0 px-2 py-2.5 align-middle text-sm font-medium leading-snug whitespace-normal break-words">
                    {w} × {l} {t(`${QA}.unitMm`)}
                  </TableCell>
                  <TableCell className="min-w-0 px-2 py-2.5 align-middle text-sm tabular-nums leading-snug whitespace-normal">
                    {t(`${QA}.nestingSummaryValueThicknessMm`, {
                      mm: mmRounded,
                    })}
                  </TableCell>
                  <TableCell className="min-w-0 px-2 py-2.5 align-middle text-sm tabular-nums">
                    {first.totalSheetsForThickness}
                  </TableCell>
                  <TableCell className="min-w-0 overflow-hidden px-2 py-2.5 align-middle text-start text-sm leading-snug">
                    <span
                      className="block truncate"
                      title={displayNestingMaterialGradeKey(gradeKey)}
                    >
                      {displayNestingMaterialGradeKey(gradeKey)}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-0 px-2 py-2.5 align-middle text-sm">
                    {isCorrugated ? t("common.yes") : t("common.no")}
                  </TableCell>
                  <TableCell className="min-w-0 px-2 py-2.5 align-middle text-sm tabular-nums text-foreground">
                    {utilPct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="min-w-0 px-2 py-2.5 align-middle text-sm tabular-nums text-foreground">
                    {wastePct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="min-w-0 px-0.5 py-2 align-middle">
                    <div className="flex w-full justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => setModalGroupKey(key)}
                        aria-pressed={modalGroupKey === key}
                        aria-label={t(`${QA}.nestingTableViewAria`)}
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={modalGroupKey !== null}
        onOpenChange={(open) => {
          if (!open) setModalGroupKey(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(90vh,900px)] w-[min(100vw-1.5rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[56rem]"
          dir="rtl"
        >
          {modalGroup && (
            <>
              <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 pb-4 pt-5 text-start sm:px-6 sm:pt-6">
                <DialogTitle className="text-base font-semibold">
                  {t(`${QA}.nestingModalTitle`)}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">{modalSubtitle}</p>
              </DialogHeader>
              <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-6">
                <SheetsTwoColumnGrid
                  layouts={modalGroup.layouts}
                  showThickness={!multipleThicknesses}
                  singleColumnFullWidth
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
