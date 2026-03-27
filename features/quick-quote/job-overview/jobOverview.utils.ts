import { thicknessGroupKey } from "@/lib/nesting/stockConfiguration";
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
  PartFootprint,
  SizeRangeInfo,
  UtilizationBand,
} from "./jobOverview.types";

/** Same yield assumption as `deriveQuoteSelection` sheet estimate. */
const NEST_YIELD_ASSUMPTION = 0.67;

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

function footprintFromPart(p: QuotePartRow): PartFootprint {
  const lengthMm = safeFinite(p.lengthMm);
  const widthMm = safeFinite(p.widthMm);
  return {
    lengthMm,
    widthMm,
    areaMm2: Math.max(0, lengthMm * widthMm),
  };
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
 * Pick the stock size that needs the fewest sheets for this net area (matches quote logic).
 */
export function estimateSheetsForNetArea(
  netAreaM2: number,
  stockLines: { sheetLengthMm: number; sheetWidthMm: number }[]
): { sheetCount: number; lengthMm: number; widthMm: number } | null {
  const net = Math.max(0, safeFinite(netAreaM2));
  if (net <= 0 || stockLines.length === 0) return null;

  let bestSheets = Infinity;
  let best: { sheetCount: number; lengthMm: number; widthMm: number } | null = null;

  for (const line of stockLines) {
    const sheetM2 = (line.sheetLengthMm * line.sheetWidthMm) / 1_000_000;
    if (sheetM2 <= 0) continue;
    const sheets = Math.max(
      1,
      Math.ceil(net / (sheetM2 * NEST_YIELD_ASSUMPTION))
    );
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
    const est = estimateSheetsForNetArea(r.netAreaM2, lines);
    r.stockSheetsCaption = est
      ? formatStockSheetsCaption(est)
      : "Could not estimate sheets for this line";
  }

  return rows;
}

/** Recharts treemap leaves: area ∝ job share (mass or net area proxy). */
export function buildMaterialTreemapLeaves(
  rows: MaterialBreakdownRow[]
): Array<{
  name: string;
  value: number;
  sharePct: number;
  netAreaM2: number;
  massKg: number;
  stockSheetsCaption: string | null;
}> {
  return rows.map((r) => ({
    name: r.label,
    value: Math.max(
      r.massKg > 0 ? r.massKg : r.netAreaM2 * 100,
      1e-6
    ),
    sharePct: r.share * 100,
    netAreaM2: r.netAreaM2,
    massKg: r.massKg,
    stockSheetsCaption: r.stockSheetsCaption,
  }));
}

export function buildSizeRange(parts: QuotePartRow[]): SizeRangeInfo | null {
  if (parts.length === 0) return null;
  const prints = parts.map(footprintFromPart);
  let largest = prints[0];
  let smallest = prints[0];
  for (const fp of prints) {
    if (fp.areaMm2 > largest.areaMm2) largest = fp;
    if (fp.areaMm2 < smallest.areaMm2) smallest = fp;
  }
  return { largest, smallest };
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

function buildQuickInsights(model: JobOverviewModel): string[] {
  const lines: string[] = [];

  if (model.utilizationPct < 55) {
    lines.push(
      "Low utilization suggests high material waste relative to the estimated nested sheets."
    );
  }

  const piercePerPart =
    model.totalPierceCount / Math.max(model.totalParts, 1);
  if (piercePerPart > 14) {
    lines.push(
      "High pierce count indicates relatively complex cutting geometry (holes and starts)."
    );
  }

  const top = model.materialBreakdown[0];
  if (top && top.share >= 0.5) {
    lines.push(
      `Most of the job is concentrated in ${top.label} (${(top.share * 100).toFixed(0)}% by weight).`
    );
  }

  if (model.complexity === "High" && lines.length < 3) {
    lines.push(
      "Overall job load is high — plan extra time for nesting validation and CAM checks."
    );
  }

  if (model.totalPlates > 80 && lines.length < 3) {
    lines.push("Large total plate count — confirm batching and material call-offs early.");
  }

  return lines.slice(0, 3);
}

export function buildJobOverview(input: BuildJobOverviewInput): JobOverviewModel {
  const { jobSummary, mfgParams, parts, thicknessStock } = input;

  const materialBreakdown = buildMaterialBreakdown(parts, thicknessStock);
  const sizeRange = buildSizeRange(parts);
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
    totalCutLengthMm: safeFinite(jobSummary.totalCutLengthMm),
    totalPierceCount: Math.max(0, Math.round(safeFinite(jobSummary.totalPierceCount))),
    complexity,
    complexitySubtext,
    materialBreakdown,
    sizeRange,
    quickInsights: [],
  };

  model.quickInsights = buildQuickInsights(model);
  return model;
}
