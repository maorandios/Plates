import type { MaterialType } from "@/types/materials";
import type { PurchasedSheetSize } from "@/types/settings";
import { nanoid } from "@/lib/utils/nanoid";
import {
  hasDuplicateSheetSizes,
  seedSheetsForThickness,
} from "./quoteStockAvailability";
import { rectPackEstimate } from "@/lib/quotes/rectPackNesting";
import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  PricingSummary,
  QuotePartRow,
  ThicknessStockInput,
  ValidationRecap,
  ValidationRow,
  ValidationSummary,
} from "../types/quickQuote";
import {
  MOCK_JOB_SUMMARY,
  MOCK_MFG_PARAMETERS,
  MOCK_PRICING_SUMMARY,
  MOCK_QUOTE_PART_ROWS,
  MOCK_VALIDATION_ROWS,
} from "../mock/quickQuoteMockData";

function roundN(n: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

/** Quote part rows aligned by index with `MOCK_VALIDATION_ROWS`. */
export function quotePartsForValidationSelection(
  selected: ValidationRow[]
): QuotePartRow[] {
  const idSet = new Set(selected.map((r) => r.id));
  return MOCK_QUOTE_PART_ROWS.filter((_, i) =>
    idSet.has(MOCK_VALIDATION_ROWS[i].id)
  );
}

export function jobSummaryFromParts(parts: QuotePartRow[]): JobSummaryMetrics {
  const uniqueParts = parts.length;
  const totalQty = parts.reduce((a, p) => a + p.qty, 0);
  const totalPlateAreaM2 = roundN(
    parts.reduce((a, p) => a + p.areaM2 * p.qty, 0),
    2
  );
  const totalEstWeightKg = roundN(
    parts.reduce((a, p) => a + p.weightKg * p.qty, 0),
    1
  );
  const totalCutLengthMm = Math.round(
    parts.reduce((a, p) => a + p.cutLengthMm * p.qty, 0)
  );
  const totalPierceCount = Math.round(
    parts.reduce((a, p) => a + p.pierceCount * p.qty, 0)
  );
  return {
    uniqueParts,
    totalQty,
    totalPlateAreaM2,
    totalEstWeightKg,
    totalCutLengthMm,
    totalPierceCount,
  };
}

export function validationSummaryFromRows(
  rows: ValidationRow[]
): ValidationSummary {
  return {
    totalRows: rows.length,
    matched: rows.filter((r) => r.status === "valid").length,
    warnings: rows.filter((r) => r.status === "warning").length,
    critical: rows.filter((r) => r.status === "error").length,
  };
}

export function validationRecapFromRows(rows: ValidationRow[]): ValidationRecap {
  const fullyMatched = rows.filter((r) => r.status === "valid").length;
  const warningItems = rows.filter((r) => r.status === "warning").length;
  const errorItems = rows.filter((r) => r.status === "error").length;
  if (rows.length === 0) {
    return {
      fullyMatched: 0,
      warningItems: 0,
      errorItems: 0,
      confidenceNote: "No parts were included in this quote run.",
    };
  }
  if (errorItems > 0) {
    return {
      fullyMatched,
      warningItems,
      errorItems,
      confidenceNote:
        "Selected parts include critical Excel/DXF mismatches — reconcile before production.",
    };
  }
  if (warningItems > 0) {
    return {
      fullyMatched,
      warningItems,
      errorItems,
      confidenceNote:
        "Some selected parts have warnings; pricing may need written assumptions.",
    };
  }
  return {
    fullyMatched,
    warningItems,
    errorItems,
    confidenceNote: "All selected parts matched between Excel and DXF.",
  };
}

function scaleByWeightFactor(
  baseWeight: number,
  selectedWeight: number
): number {
  if (baseWeight <= 0) return 0;
  return Math.min(1, selectedWeight / baseWeight);
}

function hasSheetsArray(r: ThicknessStockInput | unknown): r is ThicknessStockInput {
  return (
    typeof r === "object" &&
    r !== null &&
    "sheets" in r &&
    Array.isArray((r as ThicknessStockInput).sheets)
  );
}

/** Legacy row shape before multi-sheet (single dimensions on the thickness row). */
type LegacyThicknessRow = {
  thicknessMm: number;
  sheetLengthMm: number;
  sheetWidthMm: number;
};

function isLegacyThicknessRow(r: unknown): r is LegacyThicknessRow {
  return (
    typeof r === "object" &&
    r !== null &&
    "sheetLengthMm" in r &&
    "sheetWidthMm" in r &&
    !("sheets" in r)
  );
}

/** True when every thickness has at least one sheet with valid dimensions and no duplicate sizes. */
export function isThicknessStockComplete(rows: ThicknessStockInput[]): boolean {
  if (rows.length === 0) return false;
  return rows.every((t) => {
    if (t.sheets.length === 0) return false;
    const dimsOk = t.sheets.every(
      (s) =>
        s.sheetLengthMm > 0 &&
        s.sheetWidthMm > 0 &&
        Number.isFinite(s.sheetLengthMm) &&
        Number.isFinite(s.sheetWidthMm)
    );
    return dimsOk && !hasDuplicateSheetSizes(t.sheets);
  });
}

export function mergeDefaultStockRows(
  parts: QuotePartRow[],
  prev: ThicknessStockInput[],
  materialType: MaterialType,
  purchasedCatalog: PurchasedSheetSize[]
): ThicknessStockInput[] {
  const unique = [...new Set(parts.map((p) => p.thicknessMm))].sort(
    (a, b) => a - b
  );
  const prevMap = new Map(prev.map((r) => [r.thicknessMm, r]));
  return unique.map((th) => {
    const old = prevMap.get(th);
    if (old && hasSheetsArray(old) && old.sheets.length > 0) {
      return { thicknessMm: th, sheets: old.sheets };
    }
    if (old && isLegacyThicknessRow(old)) {
      const { sheetLengthMm, sheetWidthMm } = old;
      if (sheetLengthMm > 0 && sheetWidthMm > 0) {
        return {
          thicknessMm: th,
          sheets: [
            {
              id: nanoid(),
              sheetLengthMm,
              sheetWidthMm,
            },
          ],
        };
      }
    }
    return {
      thicknessMm: th,
      sheets: seedSheetsForThickness(materialType, th, purchasedCatalog),
    };
  });
}

function stockMapFromRows(
  rows: ThicknessStockInput[]
): Map<number, ThicknessStockInput> {
  return new Map(rows.map((r) => [r.thicknessMm, r]));
}

/** Σ (line weight × purchase price/kg); one global price applies to all thicknesses. */
export function computeMaterialCostFromStock(
  parts: QuotePartRow[],
  stock: Map<number, ThicknessStockInput>,
  pricePerKg: number
): number {
  let sum = 0;
  for (const p of parts) {
    const s = stock.get(p.thicknessMm);
    if (!s) continue;
    const lineKg = p.weightKg * p.qty;
    sum += lineKg * pricePerKg;
  }
  return roundN(sum, 1);
}

function formatStockSummary(rows: ThicknessStockInput[], pricePerKg: number): string {
  const byTh = rows
    .map((r) => {
      const sizes = r.sheets
        .map((s) => `${s.sheetLengthMm} × ${s.sheetWidthMm} mm`)
        .join(", ");
      return `${r.thicknessMm} mm: ${sizes}`;
    })
    .join(" · ");
  return `${byTh} · ${pricePerKg}/kg`;
}

/**
 * Runs a shelf/row rect-pack simulation to estimate sheet count, gross area,
 * and true waste for the given parts against the configured stock sheet sizes.
 *
 * Each thickness in `stockRows` shares the same candidate sheet sizes (we pick
 * whichever size minimises the sheet count for that thickness's parts).
 */
function estimateSheetUsageFromStock(
  parts: QuotePartRow[],
  stockRows: ThicknessStockInput[]
): Pick<
  ManufacturingParameters,
  "totalSheetAreaM2" | "estimatedSheetCount" | "utilizationPct" | "wasteAreaM2"
> {
  // Collect all unique sheet sizes across all thickness rows
  const allSheetSizes = new Map<string, { sheetWidthMm: number; sheetLengthMm: number }>();
  for (const row of stockRows) {
    for (const s of row.sheets) {
      if (s.sheetLengthMm > 0 && s.sheetWidthMm > 0) {
        const key = `${s.sheetWidthMm}x${s.sheetLengthMm}`;
        if (!allSheetSizes.has(key)) {
          allSheetSizes.set(key, { sheetWidthMm: s.sheetWidthMm, sheetLengthMm: s.sheetLengthMm });
        }
      }
    }
  }

  const stockLines = [...allSheetSizes.values()];
  if (stockLines.length === 0 || parts.length === 0) {
    return {
      totalSheetAreaM2: 0,
      estimatedSheetCount: 0,
      utilizationPct: MOCK_MFG_PARAMETERS.utilizationPct,
      wasteAreaM2: 0,
    };
  }

  const packParts = parts.map((p) => ({
    thicknessMm: p.thicknessMm,
    widthMm: p.widthMm,
    lengthMm: p.lengthMm,
    areaM2: p.areaM2,
    qty: p.qty,
  }));

  const result = rectPackEstimate(packParts, stockLines);

  return {
    totalSheetAreaM2: result.totalSheetAreaM2,
    estimatedSheetCount: result.estimatedSheetCount,
    utilizationPct: result.utilizationPct > 0 ? result.utilizationPct : MOCK_MFG_PARAMETERS.utilizationPct,
    wasteAreaM2: result.totalWasteAreaM2,
  };
}

function thicknessGroupLabel(parts: QuotePartRow[]): string {
  const t = [...new Set(parts.map((p) => p.thicknessMm))].sort((a, b) => a - b);
  if (t.length === 0) return MOCK_MFG_PARAMETERS.thicknessGroup;
  if (t.length === 1) return `${t[0]} mm`;
  return `${t[0]}–${t[t.length - 1]} mm`;
}

export function scaleManufacturingAndPricing(
  parts: QuotePartRow[],
  baseJob: JobSummaryMetrics,
  baseMfg: ManufacturingParameters,
  basePricing: PricingSummary
): { mfg: ManufacturingParameters; pricing: PricingSummary } {
  const selectedJob = jobSummaryFromParts(parts);
  const f = scaleByWeightFactor(baseJob.totalEstWeightKg, selectedJob.totalEstWeightKg);

  const mfg: ManufacturingParameters = {
    ...baseMfg,
    totalNetPlateAreaM2: roundN(baseMfg.totalNetPlateAreaM2 * f, 2),
    totalCutLengthMm: Math.round(baseMfg.totalCutLengthMm * f),
    totalPierceCount: Math.round(baseMfg.totalPierceCount * f),
    estimatedMachineTimeMin: Math.max(
      1,
      Math.round(baseMfg.estimatedMachineTimeMin * f)
    ),
    totalSheetAreaM2: roundN(
      Math.max(baseMfg.totalSheetAreaM2 * f, baseMfg.totalSheetAreaM2 * 0.12),
      2
    ),
    wasteAreaM2: roundN(
      Math.max(baseMfg.wasteAreaM2 * f, 0),
      2
    ),
    estimatedSheetCount: Math.max(
      1,
      Math.round(baseMfg.estimatedSheetCount * f)
    ),
    utilizationPct: roundN(
      Math.min(95, baseMfg.utilizationPct + (f < 1 ? (1 - f) * 4 : 0)),
      1
    ),
  };

  const pricing: PricingSummary = {
    materialCost: roundN(basePricing.materialCost * f, 1),
    cuttingCost: roundN(basePricing.cuttingCost * f, 1),
    piercingCost: roundN(basePricing.piercingCost * f, 1),
    setupCost: basePricing.setupCost,
    overhead: roundN(basePricing.overhead * f, 1),
    margin: roundN(basePricing.margin * f, 1),
    finalEstimatedPrice: roundN(basePricing.finalEstimatedPrice * f, 1),
    pricePerKg:
      selectedJob.totalEstWeightKg > 0
        ? roundN(
            (basePricing.finalEstimatedPrice * f) / selectedJob.totalEstWeightKg,
            2
          )
        : basePricing.pricePerKg,
    avgPricePerPart:
      parts.length > 0
        ? roundN((basePricing.finalEstimatedPrice * f) / parts.length, 1)
        : 0,
    internalEstCost: roundN(basePricing.internalEstCost * f, 1),
  };

  return { mfg, pricing };
}

export function buildSelectionBundle(
  rows: ValidationRow[],
  stockByThickness?: ThicknessStockInput[] | null,
  materialPricePerKg?: number
) {
  const parts = quotePartsForValidationSelection(rows);
  const jobSummary = jobSummaryFromParts(parts);
  const validationSummary = validationSummaryFromRows(rows);
  const validationRecap = validationRecapFromRows(rows);
  let { mfg, pricing } = scaleManufacturingAndPricing(
    parts,
    MOCK_JOB_SUMMARY,
    MOCK_MFG_PARAMETERS,
    MOCK_PRICING_SUMMARY
  );

  if (
    stockByThickness?.length &&
    isThicknessStockComplete(stockByThickness) &&
    materialPricePerKg != null &&
    Number.isFinite(materialPricePerKg)
  ) {
    const stock = stockMapFromRows(stockByThickness);
    const sheetMetrics = estimateSheetUsageFromStock(parts, stockByThickness);
    mfg = {
      ...mfg,
      ...sheetMetrics,
      totalNetPlateAreaM2: jobSummary.totalPlateAreaM2,
      materialRatePerKg: roundN(materialPricePerKg, 2),
      standardStockSize: formatStockSummary(stockByThickness, materialPricePerKg),
      thicknessGroup: thicknessGroupLabel(parts),
    };

    const userMaterial = computeMaterialCostFromStock(
      parts,
      stock,
      materialPricePerKg
    );
    const deltaMat = userMaterial - pricing.materialCost;
    const newFinal = roundN(pricing.finalEstimatedPrice + deltaMat, 1);
    pricing = {
      ...pricing,
      materialCost: userMaterial,
      finalEstimatedPrice: newFinal,
      internalEstCost: roundN(pricing.internalEstCost + deltaMat, 1),
      pricePerKg:
        jobSummary.totalEstWeightKg > 0
          ? roundN(newFinal / jobSummary.totalEstWeightKg, 2)
          : pricing.pricePerKg,
      avgPricePerPart:
        parts.length > 0
          ? roundN(newFinal / parts.length, 1)
          : pricing.avgPricePerPart,
    };
  }

  return {
    validationRows: rows,
    parts,
    jobSummary,
    validationSummary,
    validationRecap,
    mfgParams: mfg,
    pricing,
  };
}

/**
 * Same pricing/manufacturing pipeline as {@link buildSelectionBundle}, but with explicit
 * part rows (e.g. bend-plate geometry) instead of Excel/DXF validation rows.
 */
export function buildSelectionBundleFromParts(
  parts: QuotePartRow[],
  stockByThickness?: ThicknessStockInput[] | null,
  materialPricePerKg?: number
) {
  const jobSummary = jobSummaryFromParts(parts);
  const validationSummary: ValidationSummary = {
    totalRows: parts.length,
    matched: parts.length,
    warnings: 0,
    critical: 0,
  };
  const validationRecap: ValidationRecap = {
    fullyMatched: parts.length,
    warningItems: 0,
    errorItems: 0,
    confidenceNote:
      parts.length > 0
        ? "Line items from the selected quote method (dimensions × quantities)."
        : "No parts in this quote run.",
  };
  let { mfg, pricing } = scaleManufacturingAndPricing(
    parts,
    MOCK_JOB_SUMMARY,
    MOCK_MFG_PARAMETERS,
    MOCK_PRICING_SUMMARY
  );

  if (
    stockByThickness?.length &&
    isThicknessStockComplete(stockByThickness) &&
    materialPricePerKg != null &&
    Number.isFinite(materialPricePerKg)
  ) {
    const stock = stockMapFromRows(stockByThickness);
    const sheetMetrics = estimateSheetUsageFromStock(parts, stockByThickness);
    mfg = {
      ...mfg,
      ...sheetMetrics,
      totalNetPlateAreaM2: jobSummary.totalPlateAreaM2,
      materialRatePerKg: roundN(materialPricePerKg, 2),
      standardStockSize: formatStockSummary(stockByThickness, materialPricePerKg),
      thicknessGroup: thicknessGroupLabel(parts),
    };

    const userMaterial = computeMaterialCostFromStock(
      parts,
      stock,
      materialPricePerKg
    );
    const deltaMat = userMaterial - pricing.materialCost;
    const newFinal = roundN(pricing.finalEstimatedPrice + deltaMat, 1);
    pricing = {
      ...pricing,
      materialCost: userMaterial,
      finalEstimatedPrice: newFinal,
      internalEstCost: roundN(pricing.internalEstCost + deltaMat, 1),
      pricePerKg:
        jobSummary.totalEstWeightKg > 0
          ? roundN(newFinal / jobSummary.totalEstWeightKg, 2)
          : pricing.pricePerKg,
      avgPricePerPart:
        parts.length > 0
          ? roundN(newFinal / parts.length, 1)
          : pricing.avgPricePerPart,
    };
  }

  return {
    validationRows: [] as ValidationRow[],
    parts,
    jobSummary,
    validationSummary,
    validationRecap,
    mfgParams: mfg,
    pricing,
  };
}
