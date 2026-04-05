import { thicknessGroupKey } from "@/lib/nesting/stockConfiguration";
import {
  rectPackEstimate,
  type RectPackPart,
  type RectPackStockLine,
} from "@/lib/quotes/rectPackNesting";
import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  QuotePartRow,
  ThicknessStockInput,
} from "../types/quickQuote";
import type {
  BuildJobOverviewInput,
  ComplexityLevel,
  JobOverviewModel,
  MaterialBreakdownRow,
  StockSheetSizeBreakdownRow,
  UtilizationBand,
} from "./jobOverview.types";


function safeFinite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

export function formatWeightKg(kg: number): string {
  const k = Math.max(0, safeFinite(kg));
  return `${k.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

export function formatAreaM2(m2: number, fractionDigits = 2): string {
  const a = Math.max(0, safeFinite(m2));
  return `${a.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} m²`;
}

export function formatCutLengthM(mm: number): string {
  const m = Math.max(0, safeFinite(mm)) / 1000;
  return `${m.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m`;
}

export function formatDimensionsMm(lengthMm: number, widthMm: number): string {
  const l = Math.round(safeFinite(lengthMm));
  const w = Math.round(safeFinite(widthMm));
  return `${l.toLocaleString()} × ${w.toLocaleString()} mm`;
}

export function utilizationToBand(utilizationPct: number): UtilizationBand {
  const u = safeFinite(utilizationPct);
  if (u < 48) return "Low efficiency";
  if (u < 68) return "Moderate efficiency";
  return "Good efficiency";
}

type AggBucket = {
  label: string;
  thicknessMm: number;
  massKg: number;
  netAreaM2: number;
};

export function stockLinesForThickness(
  thicknessMm: number,
  thicknessStock: ThicknessStockInput[] | null | undefined
): { sheetLengthMm: number; sheetWidthMm: number }[] {
  if (!thicknessStock?.length) return [];
  const key = thicknessGroupKey(thicknessMm);
  const row = thicknessStock.find(
    (t) => thicknessGroupKey(t.thicknessMm) === key
  );
  if (!row?.sheets?.length) return [];
  return row.sheets.filter(
    (s) =>
      s.sheetLengthMm > 0 &&
      s.sheetWidthMm > 0 &&
      Number.isFinite(s.sheetLengthMm) &&
      Number.isFinite(s.sheetWidthMm)
  );
}

/**
 * Pick the stock size that needs the fewest sheets for this net area.
 * Uses rect-pack when individual part dimensions are available, otherwise
 * falls back to a single-rectangle proxy for the aggregate area.
 */
export function estimateSheetsForNetArea(
  netAreaM2: number,
  stockLines: { sheetLengthMm: number; sheetWidthMm: number }[],
  parts?: QuotePartRow[]
): { sheetCount: number; lengthMm: number; widthMm: number } | null {
  const net = Math.max(0, safeFinite(netAreaM2));
  if (net <= 0 || stockLines.length === 0) return null;

  // Use rect-pack when part-level data is available
  if (parts && parts.length > 0) {
    const packParts = parts.map((p) => ({
      thicknessMm: p.thicknessMm,
      widthMm: p.widthMm,
      lengthMm: p.lengthMm,
      areaM2: p.areaM2,
      qty: p.qty,
    }));
    const result = rectPackEstimate(packParts, stockLines);

    // Find which sheet size was picked most (best result)
    if (result.perThickness.length > 0) {
      // Return the single thickness result (this fn is called per-thickness)
      const th = result.perThickness[0];
      return {
        sheetCount: th.sheetCount,
        lengthMm: th.sheetLengthMm,
        widthMm: th.sheetWidthMm,
      };
    }
  }

  // Fallback: treat entire net area as one rectangle proxy, pick best sheet size
  let bestSheets = Infinity;
  let best: { sheetCount: number; lengthMm: number; widthMm: number } | null = null;

  for (const line of stockLines) {
    const sheetM2 = (line.sheetLengthMm * line.sheetWidthMm) / 1_000_000;
    if (sheetM2 <= 0) continue;
    // Use a generous 75% area estimate as fallback (better than the old 67%)
    const sheets = Math.max(1, Math.ceil(net / (sheetM2 * 0.75)));
    if (sheets < bestSheets) {
      bestSheets = sheets;
      best = {
        sheetCount: sheets,
        lengthMm: line.sheetLengthMm,
        widthMm: line.sheetWidthMm,
      };
    }
  }
  return best;
}

function formatStockSheetsCaption(
  est: { sheetCount: number; lengthMm: number; widthMm: number }
): string {
  const n = est.sheetCount;
  const dim = formatDimensionsMm(est.lengthMm, est.widthMm);
  return `~${n} sheet${n === 1 ? "" : "s"} @ ${dim}`;
}

export function buildMaterialBreakdown(
  parts: QuotePartRow[],
  thicknessStock?: ThicknessStockInput[] | null
): MaterialBreakdownRow[] {
  if (parts.length === 0) return [];

  const buckets = new Map<string, AggBucket>();
  for (const p of parts) {
    const mat = (p.material || "—").trim() || "—";
    const th = safeFinite(p.thicknessMm);
    const key = `${mat} / ${th} mm`;
    const qty = Math.max(0, Math.round(safeFinite(p.qty, 1)));
    const prev = buckets.get(key) ?? {
      label: key,
      thicknessMm: th,
      massKg: 0,
      netAreaM2: 0,
    };
    prev.massKg += safeFinite(p.weightKg) * qty;
    prev.netAreaM2 += safeFinite(p.areaM2) * qty;
    buckets.set(key, prev);
  }

  let totalMass = 0;
  for (const b of buckets.values()) totalMass += b.massKg;

  let rows: MaterialBreakdownRow[];

  if (totalMass > 0) {
    rows = [...buckets.values()]
      .map((b) => ({
        label: b.label,
        share: b.massKg / totalMass,
        massKg: b.massKg,
        thicknessMm: b.thicknessMm,
        netAreaM2: b.netAreaM2,
        stockSheetsCaption: null as string | null,
      }))
      .sort((a, b) => b.share - a.share);
  } else {
    let totalArea = 0;
    for (const b of buckets.values()) totalArea += b.netAreaM2;
    if (totalArea <= 0) return [];
    rows = [...buckets.values()]
      .map((b) => ({
        label: b.label,
        share: b.netAreaM2 / totalArea,
        massKg: 0,
        thicknessMm: b.thicknessMm,
        netAreaM2: b.netAreaM2,
        stockSheetsCaption: null as string | null,
      }))
      .sort((a, b) => b.share - a.share);
  }

  const hasStockConfig = Boolean(thicknessStock?.length);

  for (const r of rows) {
    const lines = stockLinesForThickness(r.thicknessMm, thicknessStock);
    if (!hasStockConfig) {
      r.stockSheetsCaption = null;
      continue;
    }
    if (lines.length === 0) {
      r.stockSheetsCaption = "No sheet sizes for this thickness in the quote";
      continue;
    }
    // Pass the parts for this thickness so rect-pack can use exact dimensions
    const thicknessParts = parts.filter((p) => p.thicknessMm === r.thicknessMm);
    const est = estimateSheetsForNetArea(r.netAreaM2, lines, thicknessParts.length > 0 ? thicknessParts : undefined);
    r.stockSheetsCaption = est
      ? formatStockSheetsCaption(est)
      : "Could not estimate sheets for this line";
  }

  return rows;
}

/** Unique stock sheet sizes from quote stock (same rule as nesting preview). */
export function stockLinesFromThicknessStock(
  thicknessStock?: ThicknessStockInput[] | null
): RectPackStockLine[] {
  if (!thicknessStock?.length) return [];
  const sizeMap = new Map<string, RectPackStockLine>();
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
  return [...sizeMap.values()];
}

/**
 * Nesting run **per material × thickness** (not merged). Each line is the chosen stock sheet
 * size for that grade/thickness group plus gross / net / waste / utilization.
 */
export function buildStockSheetSizeBreakdown(
  parts: QuotePartRow[],
  thicknessStock?: ThicknessStockInput[] | null
): StockSheetSizeBreakdownRow[] {
  const stockLines = stockLinesFromThicknessStock(thicknessStock);
  if (stockLines.length === 0 || parts.length === 0) return [];

  const byMatTh = new Map<string, QuotePartRow[]>();
  for (const p of parts) {
    const mat = (p.material || "—").trim() || "—";
    const tk = thicknessGroupKey(p.thicknessMm);
    const key = `${mat}\u0000${tk}`;
    const list = byMatTh.get(key);
    if (list) list.push(p);
    else byMatTh.set(key, [p]);
  }

  const rows: StockSheetSizeBreakdownRow[] = [];

  for (const [, groupParts] of byMatTh) {
    const first = groupParts[0];
    const material = (first.material || "—").trim() || "—";
    const thicknessMm = safeFinite(first.thicknessMm);

    const packParts: RectPackPart[] = groupParts.map((p) => ({
      thicknessMm: p.thicknessMm,
      widthMm: p.widthMm,
      lengthMm: p.lengthMm,
      areaM2: p.areaM2,
      qty: p.qty,
    }));

    const result = rectPackEstimate(packParts, stockLines, 0);
    const th = result.perThickness[0];
    if (!th) continue;

    const gross = th.sheetCount * th.sheetAreaM2;
    const waste = Math.max(0, gross - th.netAreaM2);
    const util =
      gross > 0 ? Math.round((th.netAreaM2 / gross) * 1000) / 10 : 0;
    const w = Math.round(safeFinite(th.sheetWidthMm));
    const l = Math.round(safeFinite(th.sheetLengthMm));
    const thRounded = Math.round(thicknessMm * 100) / 100;

    rows.push({
      label: `${material} · ${thRounded} mm · ${w.toLocaleString()} × ${l.toLocaleString()} mm`,
      material,
      thicknessMm: thRounded,
      sheetWidthMm: th.sheetWidthMm,
      sheetLengthMm: th.sheetLengthMm,
      sheetAreaM2: th.sheetAreaM2,
      sheetCount: th.sheetCount,
      grossStockAreaM2: gross,
      netPlateAreaM2: th.netAreaM2,
      wasteAreaM2: waste,
      utilizationPct: util,
    });
  }

  rows.sort((a, b) => b.grossStockAreaM2 - a.grossStockAreaM2);
  return rows;
}

const AGG_ALL_MATERIALS_LABEL = "All materials";

/**
 * Collapse nested stock lines to one row per thickness (sums gross / net / waste / sheets across
 * materials and sheet sizes). Used when the breakdown filters are at default (full job view).
 */
export function aggregateStockSheetBreakdownByThickness(
  rows: StockSheetSizeBreakdownRow[]
): StockSheetSizeBreakdownRow[] {
  if (rows.length === 0) return [];

  const byKey = new Map<
    string,
    {
      thicknessMm: number;
      grossStockAreaM2: number;
      netPlateAreaM2: number;
      sheetCount: number;
    }
  >();

  for (const r of rows) {
    const key = thicknessGroupKey(r.thicknessMm);
    const cur = byKey.get(key);
    if (cur) {
      cur.grossStockAreaM2 += r.grossStockAreaM2;
      cur.netPlateAreaM2 += r.netPlateAreaM2;
      cur.sheetCount += r.sheetCount;
    } else {
      byKey.set(key, {
        thicknessMm: r.thicknessMm,
        grossStockAreaM2: r.grossStockAreaM2,
        netPlateAreaM2: r.netPlateAreaM2,
        sheetCount: r.sheetCount,
      });
    }
  }

  const out: StockSheetSizeBreakdownRow[] = [];
  for (const [, v] of byKey) {
    const gross = v.grossStockAreaM2;
    const net = v.netPlateAreaM2;
    const waste = Math.max(0, gross - net);
    const util =
      gross > 0 ? Math.round((net / gross) * 1000) / 10 : 0;
    const thRounded = Math.round(v.thicknessMm * 100) / 100;
    const sheetCount = v.sheetCount;
    const sheetAreaM2 =
      sheetCount > 0 && gross > 0 ? gross / sheetCount : 0;

    out.push({
      label: `${thRounded} mm`,
      material: AGG_ALL_MATERIALS_LABEL,
      thicknessMm: thRounded,
      sheetWidthMm: 0,
      sheetLengthMm: 0,
      sheetAreaM2,
      sheetCount,
      grossStockAreaM2: gross,
      netPlateAreaM2: net,
      wasteAreaM2: waste,
      utilizationPct: util,
    });
  }

  out.sort((a, b) => a.thicknessMm - b.thicknessMm);
  return out;
}

function classifyComplexity(
  jobSummary: JobSummaryMetrics,
  parts: QuotePartRow[]
): { level: ComplexityLevel; subtext: string } {
  const unique = Math.max(0, jobSummary.uniqueParts);
  const cutMm = safeFinite(jobSummary.totalCutLengthMm);
  const pierce = safeFinite(jobSummary.totalPierceCount);
  const piercePerPart = pierce / Math.max(unique, 1);

  let score = 0;
  if (cutMm > 18_000) score += 2;
  if (cutMm > 32_000) score += 2;
  if (pierce > 120) score += 2;
  if (pierce > 260) score += 2;
  if (unique > 12) score += 2;
  if (unique > 22) score += 1;
  if (piercePerPart > 18) score += 2;
  if (piercePerPart > 28) score += 1;

  let level: ComplexityLevel = "Low";
  if (score >= 7) level = "High";
  else if (score >= 4) level = "Medium";

  let subtext = "Moderate cut load and part count for this run.";
  if (level === "Low") {
    subtext = "Relatively simple mix of plates and cut paths.";
  } else if (level === "High") {
    subtext =
      piercePerPart > 20
        ? "Dense geometry and high pierce count."
        : "Heavy cut length or many distinct parts.";
  }

  if (level === "Medium" && pierce > 180) {
    subtext = "Elevated pierce workload; review hole clusters and starts.";
  }

  return { level, subtext };
}

export function buildJobOverview(input: BuildJobOverviewInput): JobOverviewModel {
  const { jobSummary, mfgParams, parts, thicknessStock } = input;

  const materialBreakdown = buildMaterialBreakdown(parts, thicknessStock);
  const { level: complexity, subtext: complexitySubtext } = classifyComplexity(
    jobSummary,
    parts
  );

  const utilizationPct = safeFinite(mfgParams.utilizationPct);
  const model: JobOverviewModel = {
    totalParts: Math.max(0, Math.round(safeFinite(jobSummary.uniqueParts))),
    totalPlates: Math.max(0, Math.round(safeFinite(jobSummary.totalQty))),
    totalWeightKg: safeFinite(jobSummary.totalEstWeightKg),
    netPlateAreaM2: safeFinite(jobSummary.totalPlateAreaM2),
    grossMaterialAreaM2: Math.max(0, safeFinite(mfgParams.totalSheetAreaM2)),
    estimatedSheetCount: Math.max(0, Math.round(safeFinite(mfgParams.estimatedSheetCount))),
    utilizationPct,
    utilizationBand: utilizationToBand(utilizationPct),
    wasteAreaM2: Math.max(0, safeFinite(mfgParams.wasteAreaM2)),
    totalCutLengthMm: safeFinite(jobSummary.totalCutLengthMm),
    totalPierceCount: Math.max(0, Math.round(safeFinite(jobSummary.totalPierceCount))),
    complexity,
    complexitySubtext,
    materialBreakdown,
  };

  return model;
}
