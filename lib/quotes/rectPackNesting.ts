/**
 * Lightweight rectangle-pack sheet estimator for Quick Quote.
 *
 * Replaces the fixed 67% yield assumption with an actual shelf/row packing
 * of part bounding boxes. Runs synchronously in < 150 ms for ~20 000 instances
 * (2 000 unique parts × qty 10), which is fine inside a useMemo.
 *
 * Algorithm: "First Fit Decreasing Height" shelf packing, largest-first sort,
 * with 0° / 90° rotation tried per part.  Two bin orientations (portrait and
 * landscape) are compared; the one that needs fewer sheets wins.
 *
 * Safety: if a part is larger than the sheet it is counted as one extra sheet
 * (oversize flag) so the total is always >= the actual requirement.
 */

export interface RectPackPart {
  thicknessMm: number;
  /** Bounding-box width of one instance (mm). */
  widthMm: number;
  /** Bounding-box length of one instance (mm). */
  lengthMm: number;
  /** Gross area of one instance in m² (width × length / 1e6). */
  areaM2: number;
  /** Number of identical instances. */
  qty: number;
}

export interface RectPackStockLine {
  /** Stock sheet width (mm), smaller dimension. */
  sheetWidthMm: number;
  /** Stock sheet length (mm), larger dimension. */
  sheetLengthMm: number;
}

export interface RectPackThicknessResult {
  thicknessMm: number;
  sheetCount: number;
  sheetWidthMm: number;
  sheetLengthMm: number;
  sheetAreaM2: number;
  netAreaM2: number;
  wasteAreaM2: number;
  utilizationPct: number;
  oversizeParts: number;
}

export interface RectPackResult {
  totalSheetAreaM2: number;
  totalNetAreaM2: number;
  totalWasteAreaM2: number;
  estimatedSheetCount: number;
  utilizationPct: number;
  perThickness: RectPackThicknessResult[];
}

/** One placed rectangle on a sheet (all values in mm). */
export interface PlacedRect {
  /** Distance from sheet left edge (mm). */
  x: number;
  /** Distance from sheet top edge (mm). */
  y: number;
  /** Placed width (may differ from original if rotated, mm). */
  w: number;
  /** Placed height (may differ from original if rotated, mm). */
  h: number;
}

/** Visual layout for one sheet (for display/preview purposes). */
export interface SheetLayout {
  thicknessMm: number;
  sheetWidthMm: number;
  sheetLengthMm: number;
  /** 0-based index within the sequence for this thickness. */
  sheetIndex: number;
  /** Total number of sheets needed for this thickness. */
  totalSheetsForThickness: number;
  placements: PlacedRect[];
  /** Net plate area on this sheet (m²). */
  netAreaM2: number;
  /** 0–100 utilization of this individual sheet. */
  utilizationPct: number;
}

export interface RectPackWithPlacementsResult {
  summary: RectPackResult;
  /** Per-thickness layouts, up to maxSheetsPerThickness sheets each. */
  layouts: SheetLayout[];
}

/** Floating-point tolerance in mm for shelf edge comparisons. */
const EPS_MM = 0.5;

/** Extra gap / kerf allowance between parts (mm). */
const DEFAULT_SPACING_MM = 5;

interface Instance {
  w: number;
  h: number;
  areaMm2: number;
}

/**
 * Expand `parts` (for one thickness) into a flat list of individual instances.
 * Clamps qty to a reasonable upper bound to avoid degenerate inputs.
 */
function expandInstances(parts: RectPackPart[]): Instance[] {
  const out: Instance[] = [];
  for (const p of parts) {
    const qty = Math.max(0, Math.min(Math.round(p.qty), 50_000));
    const w = Math.max(0, p.widthMm);
    const h = Math.max(0, p.lengthMm);
    const areaMm2 = w * h;
    for (let i = 0; i < qty; i++) {
      out.push({ w, h, areaMm2 });
    }
  }
  // Sort largest first (max side descending) — FFD heuristic
  out.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
  return out;
}

/**
 * Pack as many instances as possible into a single sheet using shelf/row packing.
 * Tries 0° and 90° per part.
 * Returns which instances were placed and which remain for the next sheet.
 */
function packOneSheet(
  instances: Instance[],
  binW: number,
  binH: number,
  spacing: number
): { placed: Instance[]; remaining: Instance[]; usedAreaMm2: number } {
  const placed: Instance[] = [];
  const remaining: Instance[] = [];
  let usedAreaMm2 = 0;

  let x = 0;
  let y = 0;
  let rowH = 0;

  for (const inst of instances) {
    let didPlace = false;

    // Try both orientations: original (w × h) and rotated (h × w)
    for (const [iw, ih] of [
      [inst.w, inst.h],
      [inst.h, inst.w],
    ] as [number, number][]) {
      const fw = iw + spacing;
      const fh = ih + spacing;

      // Try current shelf position
      if (
        x + fw <= binW + EPS_MM &&
        y + fh <= binH + EPS_MM
      ) {
        x += fw;
        rowH = Math.max(rowH, fh);
        placed.push(inst);
        usedAreaMm2 += inst.areaMm2;
        didPlace = true;
        break;
      }

      // Try opening a new row below current one
      const newY = y + rowH;
      if (
        fw <= binW + EPS_MM &&
        newY + fh <= binH + EPS_MM
      ) {
        y = newY;
        rowH = fh;
        x = fw;
        placed.push(inst);
        usedAreaMm2 += inst.areaMm2;
        didPlace = true;
        break;
      }
    }

    if (!didPlace) {
      remaining.push(inst);
    }
  }

  return { placed, remaining, usedAreaMm2 };
}

/**
 * Pack all instances into as many sheets as needed.
 * Returns the number of sheets used and total gross area.
 */
function packAllIntoSheets(
  instances: Instance[],
  binW: number,
  binH: number,
  spacing: number
): { sheetCount: number; totalSheetAreaMm2: number; oversizeParts: number } {
  const sheetAreaMm2 = binW * binH;
  let remaining = instances;
  let sheetCount = 0;
  let oversizeParts = 0;

  while (remaining.length > 0) {
    const { placed, remaining: next } = packOneSheet(remaining, binW, binH, spacing);

    if (placed.length === 0) {
      // Every item left is oversize — allocate one sheet each
      oversizeParts += remaining.length;
      sheetCount += remaining.length;
      break;
    }

    sheetCount++;
    remaining = next;
  }

  return {
    sheetCount,
    totalSheetAreaMm2: sheetCount * sheetAreaMm2,
    oversizeParts,
  };
}

/**
 * Try packing with a given bin size AND its 90°-swapped orientation;
 * return the result that uses fewer sheets.
 */
function bestPackForSheetSize(
  instances: Instance[],
  sheetWidthMm: number,
  sheetLengthMm: number,
  spacing: number
): ReturnType<typeof packAllIntoSheets> {
  const portrait = packAllIntoSheets(
    instances,
    sheetWidthMm,
    sheetLengthMm,
    spacing
  );
  if (Math.abs(sheetWidthMm - sheetLengthMm) < EPS_MM) {
    // Square sheet — orientation doesn't matter
    return portrait;
  }
  const landscape = packAllIntoSheets(
    instances,
    sheetLengthMm,
    sheetWidthMm,
    spacing
  );
  return portrait.sheetCount <= landscape.sheetCount ? portrait : landscape;
}

/**
 * For one thickness, try every configured sheet size and pick the one that
 * needs the fewest sheets.
 */
function estimateForThickness(
  thicknessMm: number,
  parts: RectPackPart[],
  stockLines: RectPackStockLine[],
  spacing: number
): RectPackThicknessResult | null {
  if (stockLines.length === 0) return null;

  const instances = expandInstances(parts);
  if (instances.length === 0) return null;

  const totalNetMm2 = instances.reduce((s, i) => s + i.areaMm2, 0);
  const totalNetM2 = totalNetMm2 / 1_000_000;

  let bestResult: RectPackThicknessResult | null = null;

  for (const line of stockLines) {
    const { sheetWidthMm, sheetLengthMm } = line;
    if (sheetWidthMm <= 0 || sheetLengthMm <= 0) continue;

    const pack = bestPackForSheetSize(
      instances,
      sheetWidthMm,
      sheetLengthMm,
      spacing
    );

    const sheetAreaM2 = (sheetWidthMm * sheetLengthMm) / 1_000_000;
    const totalSheetAreaM2 = (pack.totalSheetAreaMm2) / 1_000_000;
    const wasteAreaM2 = Math.max(0, totalSheetAreaM2 - totalNetM2);
    const utilizationPct =
      totalSheetAreaM2 > 0
        ? Math.round((totalNetM2 / totalSheetAreaM2) * 1000) / 10
        : 0;

    const candidate: RectPackThicknessResult = {
      thicknessMm,
      sheetCount: pack.sheetCount,
      sheetWidthMm,
      sheetLengthMm,
      sheetAreaM2,
      netAreaM2: totalNetM2,
      wasteAreaM2,
      utilizationPct,
      oversizeParts: pack.oversizeParts,
    };

    if (
      bestResult === null ||
      candidate.sheetCount < bestResult.sheetCount ||
      (candidate.sheetCount === bestResult.sheetCount &&
        candidate.wasteAreaM2 < bestResult.wasteAreaM2)
    ) {
      bestResult = candidate;
    }
  }

  return bestResult;
}

/**
 * Main entry point. Groups parts by thickness, runs shelf packing against
 * each configured stock sheet size, and returns aggregate totals.
 *
 * @param parts         All quote part rows (any thickness mix).
 * @param stockLines    Sheet sizes available (applies to all thicknesses).
 * @param spacingMm     Kerf / clearance gap between parts (default 5 mm).
 */
export function rectPackEstimate(
  parts: RectPackPart[],
  stockLines: RectPackStockLine[],
  spacingMm = DEFAULT_SPACING_MM
): RectPackResult {
  // Group parts by thickness
  const byThickness = new Map<number, RectPackPart[]>();
  for (const p of parts) {
    const th = p.thicknessMm;
    const existing = byThickness.get(th);
    if (existing) {
      existing.push(p);
    } else {
      byThickness.set(th, [p]);
    }
  }

  const perThickness: RectPackThicknessResult[] = [];

  for (const [thicknessMm, thParts] of byThickness) {
    const result = estimateForThickness(
      thicknessMm,
      thParts,
      stockLines,
      spacingMm
    );
    if (result) perThickness.push(result);
  }

  const totalSheetAreaM2 = perThickness.reduce((s, r) => s + r.sheetCount * r.sheetAreaM2, 0);
  const totalNetAreaM2 = perThickness.reduce((s, r) => s + r.netAreaM2, 0);
  const totalWasteAreaM2 = Math.max(0, totalSheetAreaM2 - totalNetAreaM2);
  const estimatedSheetCount = perThickness.reduce((s, r) => s + r.sheetCount, 0);
  const utilizationPct =
    totalSheetAreaM2 > 0
      ? Math.round((totalNetAreaM2 / totalSheetAreaM2) * 1000) / 10
      : 0;

  return {
    totalSheetAreaM2: Math.round(totalSheetAreaM2 * 100) / 100,
    totalNetAreaM2: Math.round(totalNetAreaM2 * 100) / 100,
    totalWasteAreaM2: Math.round(totalWasteAreaM2 * 100) / 100,
    estimatedSheetCount,
    utilizationPct,
    perThickness,
  };
}

// ---------------------------------------------------------------------------
// Placement-tracking variant (for visual preview only)
// ---------------------------------------------------------------------------

interface PlacedInstance extends Instance {
  px: number;  // placed x (mm)
  py: number;  // placed y (mm)
  pw: number;  // placed width (mm, respects rotation)
  ph: number;  // placed height (mm, respects rotation)
}

/**
 * Like `packOneSheet` but records x/y position for every placed rectangle.
 */
function packOneSheetWithPositions(
  instances: Instance[],
  binW: number,
  binH: number,
  spacing: number
): { placed: PlacedInstance[]; remaining: Instance[] } {
  const placed: PlacedInstance[] = [];
  const remaining: Instance[] = [];

  let x = 0;
  let y = 0;
  let rowH = 0;

  for (const inst of instances) {
    let didPlace = false;

    for (const [iw, ih] of [
      [inst.w, inst.h],
      [inst.h, inst.w],
    ] as [number, number][]) {
      const fw = iw + spacing;
      const fh = ih + spacing;

      if (x + fw <= binW + EPS_MM && y + fh <= binH + EPS_MM) {
        placed.push({ ...inst, px: x, py: y, pw: iw, ph: ih });
        x += fw;
        rowH = Math.max(rowH, fh);
        didPlace = true;
        break;
      }

      const newY = y + rowH;
      if (fw <= binW + EPS_MM && newY + fh <= binH + EPS_MM) {
        placed.push({ ...inst, px: 0, py: newY, pw: iw, ph: ih });
        y = newY;
        rowH = fh;
        x = fw;
        didPlace = true;
        break;
      }
    }

    if (!didPlace) {
      remaining.push(inst);
    }
  }

  return { placed, remaining };
}

/**
 * Run placement-tracking packing for one thickness against its best sheet size.
 * Returns `SheetLayout[]` for the first `maxSheets` sheets only.
 */
function layoutForThickness(
  thicknessMm: number,
  parts: RectPackPart[],
  bestLine: RectPackStockLine,
  spacing: number,
  maxSheets: number
): SheetLayout[] {
  const { sheetWidthMm, sheetLengthMm } = bestLine;
  const sheetAreaMm2 = sheetWidthMm * sheetLengthMm;

  // Determine which orientation (portrait vs landscape) the main estimate used
  // by comparing sheet counts — mirror the same choice as bestPackForSheetSize.
  const instances = expandInstances(parts);
  if (instances.length === 0) return [];

  const portraitCount = packAllIntoSheets(instances, sheetWidthMm, sheetLengthMm, spacing).sheetCount;
  const landscapeCount = sheetWidthMm !== sheetLengthMm
    ? packAllIntoSheets(instances, sheetLengthMm, sheetWidthMm, spacing).sheetCount
    : portraitCount;
  const useLandscape = landscapeCount < portraitCount;
  const binW = useLandscape ? sheetLengthMm : sheetWidthMm;
  const binH = useLandscape ? sheetWidthMm : sheetLengthMm;

  const totalSheetsForThickness = Math.min(portraitCount, landscapeCount);
  const layouts: SheetLayout[] = [];
  let remaining: Instance[] = [...instances];
  let sheetIndex = 0;

  while (remaining.length > 0 && sheetIndex < maxSheets) {
    const { placed, remaining: next } = packOneSheetWithPositions(
      remaining,
      binW,
      binH,
      spacing
    );

    if (placed.length === 0) break;

    const sheetNetMm2 = placed.reduce((s, p) => s + p.areaMm2, 0);
    const utilizationPct =
      sheetAreaMm2 > 0 ? Math.round((sheetNetMm2 / sheetAreaMm2) * 1000) / 10 : 0;

    layouts.push({
      thicknessMm,
      sheetWidthMm: binW,
      sheetLengthMm: binH,
      sheetIndex,
      totalSheetsForThickness,
      placements: placed.map((p) => ({ x: p.px, y: p.py, w: p.pw, h: p.ph })),
      netAreaM2: sheetNetMm2 / 1_000_000,
      utilizationPct,
    });

    sheetIndex++;
    remaining = next;
  }

  return layouts;
}

/**
 * Same as `rectPackEstimate` but also returns per-sheet placement data for
 * the first `maxSheetsPerThickness` sheets of each thickness (for visual preview).
 *
 * @param parts                   All quote part rows.
 * @param stockLines              Available sheet sizes.
 * @param spacingMm               Gap between parts (default 5 mm).
 * @param maxSheetsPerThickness   Max sheets to generate placement data for (default 3).
 */
export function rectPackWithPlacements(
  parts: RectPackPart[],
  stockLines: RectPackStockLine[],
  spacingMm = DEFAULT_SPACING_MM,
  maxSheetsPerThickness = 3
): RectPackWithPlacementsResult {
  const summary = rectPackEstimate(parts, stockLines, spacingMm);

  // Build a lookup: thicknessMm → best sheet line used by the estimator
  const byThickness = new Map<number, RectPackPart[]>();
  for (const p of parts) {
    const th = p.thicknessMm;
    const existing = byThickness.get(th);
    if (existing) existing.push(p);
    else byThickness.set(th, [p]);
  }

  const layouts: SheetLayout[] = [];

  for (const th of summary.perThickness) {
    const thParts = byThickness.get(th.thicknessMm);
    if (!thParts) continue;

    const bestLine: RectPackStockLine = {
      sheetWidthMm: th.sheetWidthMm,
      sheetLengthMm: th.sheetLengthMm,
    };

    const thLayouts = layoutForThickness(
      th.thicknessMm,
      thParts,
      bestLine,
      spacingMm,
      maxSheetsPerThickness
    );
    layouts.push(...thLayouts);
  }

  return { summary, layouts };
}
