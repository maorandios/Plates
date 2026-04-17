/**
 * DXF generation for quote package export.
 *
 *  1. DXF-sourced parts  → exact polygon from ProcessedGeometry (outer + holes).
 *  2. SHAPE/bend-plate   → flat blank rectangle (CUT) + bend lines across the
 *                          width showing press-brake die positions (BEND_LINE).
 *  3. MANUAL / EXCEL     → rectangle (widthMm × lengthMm).
 *
 * Layers:
 *   0          — cut geometry (CNC plasma/laser cuts this)
 *   MARKING    — informational text (part ID, material, thickness)
 *   BEND_LINE  — bend centerline marks for press-brake operator (SHAPE only)
 */

import {
  DxfWriter,
  LWPolylineFlags,
  Units,
  point2d,
  point3d,
} from "@tarikjabiri/dxf";
import type { DxfPartGeometry } from "@/types";
import type {
  BendPlateFormState,
  BendPlateQuoteItem,
} from "@/features/quick-quote/bend-plate/types";
import type { QuotePartRow } from "@/features/quick-quote/types/quickQuote";
import type { MaterialType } from "@/types/materials";
import {
  bendAllowanceMm,
  outsideSetbackMm,
  kFactorForMaterial,
  buildForTemplate,
} from "@/features/quick-quote/bend-plate/geometry";
import { splitMaterialGradeAndFinish } from "@/features/quick-quote/lib/plateFields";

export type { DxfPartGeometry, BendPlateQuoteItem, QuotePartRow };

// ---------------------------------------------------------------------------
// Layer names & colors (ACI)
// ---------------------------------------------------------------------------

const LAYER_CUT      = "0";
const LAYER_MARKING  = "MARKING";
const LAYER_BEND_LINE = "BEND_LINE";

const COLOR_CUT      = 7;   // white/black
const COLOR_MARKING  = 3;   // green
const COLOR_BEND     = 2;   // yellow — matches the user's sketch convention

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeText(s: string): string {
  return (s ?? "")
    .replace(/\r\n|\r|\n/g, " ")
    // Replace the middle-dot separator (·) used by formatMaterialGradeAndFinish
    // and any other non-ASCII with a safe space (DXF is ASCII-only without \U+ escapes)
    .replace(/·/g, "+")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/%/g, "%%")
    .slice(0, 250);
}

/**
 * DXF MARKING line: `PartName+Grade+Thicknessmm` — only the steel grade (not finish · label),
 * single `+` between segments, no gap before thickness.
 */
function plateMarkingLineText(part: QuotePartRow): string {
  const gradeOnly = splitMaterialGradeAndFinish(part.material).grade;
  const name = sanitizeText(part.partName);
  const grade = sanitizeText(gradeOnly).replace(/\s/g, "");
  const th = String(part.thicknessMm).replace(/\s/g, "");
  return `${name}+${grade}+${th}mm`;
}

function bendPlateMarkingLineText(part: QuotePartRow, item: BendPlateQuoteItem): string {
  const name = sanitizeText(part.partName);
  const grade = sanitizeText(item.global.material).replace(/\s/g, "");
  const th = String(item.global.thicknessMm).replace(/\s/g, "");
  return `${name}+${grade}+${th}mm`;
}

function initDxf(): DxfWriter {
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Millimeters);
  dxf.addLayer(LAYER_CUT, COLOR_CUT);
  dxf.addLayer(LAYER_MARKING, COLOR_MARKING);
  dxf.setCurrentLayerName(LAYER_CUT);
  return dxf;
}

/**
 * Left-aligned text that auto-shrinks to fit within `maxWidthMm`.
 * Placed at (x, y) — bottom-left corner in DXF coordinates.
 */
function addMarkingLine(
  dxf: DxfWriter,
  text: string,
  x: number,
  y: number,
  maxWidthMm: number,
  preferredH = 6
): void {
  const t = sanitizeText(text);
  if (!t) return;
  // Monospace estimate: char width ≈ 0.6 × height
  const maxH = maxWidthMm / (t.length * 0.6);
  const h = Math.min(preferredH, Math.max(2, maxH));
  dxf.addText(point3d(x, y, 0), h, t, { layerName: LAYER_MARKING });
}

// ---------------------------------------------------------------------------
// Strategy 1: Exact polygon from DXF processedGeometry
// ---------------------------------------------------------------------------

function dxfFromGeometry(
  dxf: DxfWriter,
  part: QuotePartRow,
  geo: DxfPartGeometry
): void {
  const pg = geo.processedGeometry;
  if (!pg || !pg.isValid || pg.outer.length < 3) {
    dxfFromRect(dxf, part);
    return;
  }

  // Outer contour
  const outerVerts = pg.outer.map(([x, y]) => ({ point: point2d(x, y) }));
  dxf.addLWPolyline(outerVerts, { flags: LWPolylineFlags.Closed });

  // Inner holes
  for (const hole of pg.holes) {
    if (hole.length < 3) continue;
    dxf.addLWPolyline(hole.map(([x, y]) => ({ point: point2d(x, y) })), {
      flags: LWPolylineFlags.Closed,
    });
  }

  // Marking — single line in the lower-left: PartName + Material + Thickness
  const bb = pg.boundingBox;
  // Text height: 5% of the shorter dimension, clamped 2–6 mm
  const textH = Math.min(6, Math.max(2, Math.min(bb.width, bb.height) * 0.05));
  // Baseline offset: ensure full text character height fits above bottom edge
  const padX = Math.max(bb.width * 0.02, 1);
  const padY = Math.max(bb.height * 0.04, textH * 1.5);
  const usableW = bb.width * 0.92;

  addMarkingLine(
    dxf,
    plateMarkingLineText(part),
    bb.minX + padX, bb.minY + padY,
    usableW, textH
  );
}

// ---------------------------------------------------------------------------
// Strategy 2: Flat blank + BEND LINES for SHAPE parts
// ---------------------------------------------------------------------------

/**
 * Flat blank (L × W) with bend-line markers.
 *
 * Bend lines are drawn on BEND_LINE layer as dashed lines perpendicular to the
 * rolling/bending direction — one line per bend, at the centerline of each
 * bend-allowance zone. This tells the press-brake operator exactly where to
 * position the die.
 *
 * Layout (top view of flat blank):
 *
 *   0          x1   x2   x3   x4          L
 *   ┌──────────┊────┊────┊────┊────────────┐
 *   │  seg A   ╎ B1 ╎ B2 ╎ B3 ╎  seg E    │  ← W (plate width)
 *   └──────────┊────┊────┊────┊────────────┘
 *              ↑ bend centerlines
 */
function dxfFromBendPlate(
  dxf: DxfWriter,
  part: QuotePartRow,
  item: BendPlateQuoteItem,
  materialType: MaterialType
): void {
  const L = item.calc.blankLengthMm;  // developed (unfolded) length — X axis
  const W = item.calc.blankWidthMm;   // plate width — Y axis

  const formState: BendPlateFormState = {
    template: item.template,
    global: item.global,
    l: item.l,
    u: item.u,
    z: item.z,
    omega: item.omega,
    gutter: item.gutter,
    plate: item.plate,
    custom: item.custom,
    segmentFaceHoles: item.segmentFaceHoles ?? [],
  };

  // ── CUT layer: flat blank rectangle (L × W from calc; plate = length × width, 90°) ──
  const markingL = L;
  const markingW = W;
  dxf.addLWPolyline(
    [
      { point: point2d(0, 0) },
      { point: point2d(L, 0) },
      { point: point2d(L, W) },
      { point: point2d(0, W) },
    ],
    { flags: LWPolylineFlags.Closed }
  );

  // ── BEND_LINE layer: one vertical line per bend ───────────────────────────
  // Walk the flat-blank layout: each segment's flat run is the finished leg
  // minus outside-setbacks from adjacent bends, separated by BA zones.
  try {

    const { straights, bends } = buildForTemplate(formState.template, formState);

    if (bends.length > 0 && straights.length > 1) {
      dxf.addLayer(LAYER_BEND_LINE, COLOR_BEND);

      const { thicknessMm } = item.global;
      const insideRadiusMm = thicknessMm;
      const kFactor = kFactorForMaterial(materialType);

      const textH = Math.min(8, Math.max(3, markingW * 0.05));
      const labelCharCount = 4;
      const labelWidth = labelCharCount * 0.6 * textH;
      const textStartY = markingW / 2 - labelWidth / 2;

      // Pre-compute OSSB for each bend
      const ossbs = bends.map((ang) =>
        outsideSetbackMm(ang, insideRadiusMm, thicknessMm)
      );

      let curX = 0;

      for (let i = 0; i < bends.length; i++) {
        // Flat run for leg i: finished length minus adjacent setbacks
        let flatRun = straights[i] ?? 0;
        if (i > 0) flatRun -= ossbs[i - 1];
        flatRun -= ossbs[i];
        curX += Math.max(0, flatRun);

        const ba = bendAllowanceMm(bends[i], insideRadiusMm, thicknessMm, kFactor);
        const bendCentreX = curX + ba / 2;

        dxf.addLine(
          point3d(bendCentreX, 0, 0),
          point3d(bendCentreX, markingW, 0),
          { layerName: LAYER_BEND_LINE }
        );

        const angleLabel = `${Math.round(bends[i])}\xb0`;
        dxf.addText(
          point3d(bendCentreX - textH * 0.3, textStartY, 0),
          textH,
          angleLabel,
          { layerName: LAYER_BEND_LINE, rotation: 90 }
        );

        curX += ba;
      }
    }
  } catch {
    // Bend-line generation failed — flat blank rectangle is still correct
  }

  // ── MARKING text: one line at the bottom-left corner of the blank ─────────
  const textH = Math.min(6, Math.max(2, Math.min(markingL, markingW) * 0.05));
  const padX = Math.max(markingL * 0.02, 1);
  const padY = Math.max(markingW * 0.04, textH * 1.5);
  const usableW = markingL * 0.92;

  addMarkingLine(dxf, bendPlateMarkingLineText(part, item), padX, padY, usableW, textH);
}

// ---------------------------------------------------------------------------
// Strategy 3: Simple rectangle for MANUAL / EXCEL parts
// ---------------------------------------------------------------------------

function dxfFromRect(dxf: DxfWriter, part: QuotePartRow): void {
  const L = Math.max(1, part.lengthMm);
  const W = Math.max(1, part.widthMm);

  dxf.addLWPolyline(
    [
      { point: point2d(0, 0) },
      { point: point2d(L, 0) },
      { point: point2d(L, W) },
      { point: point2d(0, W) },
    ],
    { flags: LWPolylineFlags.Closed }
  );

  // Text height: 5% of the shorter dimension, clamped 2–6 mm
  const textH = Math.min(6, Math.max(2, Math.min(L, W) * 0.05));
  const padX = Math.max(L * 0.02, 1);
  const padY = Math.max(W * 0.04, textH * 1.5);
  const usableW = L * 0.92;

  addMarkingLine(dxf, plateMarkingLineText(part), padX, padY, usableW, textH);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Source-aware DXF string for one `QuotePartRow`. */
export function generatePartDxfString(
  part: QuotePartRow,
  geometry: DxfPartGeometry | null,
  bendItem: BendPlateQuoteItem | null,
  materialType: MaterialType = "carbonSteel"
): string {
  const dxf = initDxf();

  if (geometry) {
    dxfFromGeometry(dxf, part, geometry);
  } else if (bendItem) {
    dxfFromBendPlate(dxf, part, bendItem, materialType);
  } else {
    dxfFromRect(dxf, part);
  }

  return dxf.stringify();
}

/** Safe filename base: strips special chars, limits length. */
export function safeFilenameBase(name: string): string {
  return (name ?? "part")
    .trim()
    .replace(/[^a-zA-Z0-9._\-\s]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60)
    .replace(/[._\-]+$/, "") || "part";
}
