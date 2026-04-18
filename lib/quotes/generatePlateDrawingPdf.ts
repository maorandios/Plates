/**
 * Client-side technical-drawing PDF for each plate (bend or flat).
 *
 * A4 landscape, Hebrew RTL:
 *   Top stripe: חתך (left) | פריסה (right)
 *   Below divider: left = profile (חתך) + bend plan strip below it; right = flat (פריסה) + title block
 *
 * Uses jsPDF + two Noto TTFs: Noto Sans Regular (Latin/digits) + Noto Sans Hebrew (Hebrew).
 * The hinted `NotoSans-Regular` build has no Hebrew; `NotoSansHebrew` has no ASCII digits.
 */

// Use browser ESM bundle — default "jspdf" resolves to node build under Turbopack and breaks (fflate Worker).
import jsPDF from "jspdf/dist/jspdf.es.min.js";
import type {
  BendPlateQuoteItem,
  BendTemplateId,
} from "@/features/quick-quote/bend-plate/types";
import type { QuotePartRow } from "@/features/quick-quote/types/quickQuote";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/types/materials";
import type { BendPlateFormState } from "@/features/quick-quote/bend-plate/types";
import {
  buildForTemplate,
  bendAllowanceMm,
  outsideSetbackMm,
  kFactorForMaterial,
  internalAnglesFromPolyline,
  type Point2,
} from "@/features/quick-quote/bend-plate/geometry";
import { bendPlateHolePolygonsOnFlatBlankMm } from "@/features/quick-quote/bend-plate/bendPlateHoleFlatBlank";
import { splitMaterialGradeAndFinish } from "@/features/quick-quote/lib/plateFields";

// ---------------------------------------------------------------------------
// Page constants (mm) — A4 landscape
// ---------------------------------------------------------------------------

const PW = 297;
const PH = 210;
const M = 10; // margin

const FL = M;       // frame left
const FR = PW - M;  // frame right
const FT = M;       // frame top
const FB = PH - M;  // frame bottom
const FW = FR - FL;  // 277
const FH = FB - FT;  // 190

/** Title block width (2 cols); flat פריסה stays on the right of the divider. */
const TB_W = 114;
const TB_H = 56;    // title block height
const TB_L = FR - TB_W;
const TB_T = FB - TB_H;
/** Vertical split: right column slightly wider (labels top-right, values bottom-left). */
const TB_SPLIT_L = 0.44;
const TB_C1 = TB_L + TB_W * TB_SPLIT_L;
/** Row height in title block — also used for view header stripes so heights match. */
const TB_ROW_H = TB_H / 6;
/** Vertical divider = left edge of title block — left = חתך + תוכנית כיפוף; right = פריסה + info. */
const SHEET_DIVIDER_X = TB_L;

/** Gap between title block and drawing row */
const GAP_ABOVE_TB = 5;
/** Top of sheet content (inside frame) */
const TOP_T = FT + 2;
/** Section title stripe height — matches title-block row height (not taller than data rows). */
const VIEW_HEADER_H = TB_ROW_H;
const HEADER_B = TOP_T + VIEW_HEADER_H;
/** Profile column ends above title block; flat column can extend to bottom when no bend plan */
const TOP_B = TB_T - GAP_ABOVE_TB;

/** Section titles in header — must fit within `VIEW_HEADER_H` (one title-block row). */
const VIEW_TITLE_FONT_SIZE = Math.min(14, Math.max(9, TB_ROW_H * 1.15));

/** Gap straddling vertical divider line */
const SPLIT_GAP = 0.8;

/** Hebrew millimetres — `מ״מ` using gershayim (U+05F4). */
const HEB_MM = "\u05DE\u05F4\u05DE";
/**
 * Hebrew kg — intended visual `ק״ג`. jsPDF mirrors some two-letter abbrevs; logical `ג״ק`
 * renders as ק״ג (swap relative to Unicode spelling).
 */
const HEB_KG = "\u05D2\u05F4\u05E7";
/**
 * Hebrew m² — intended visual `מ״ר`. Logical `ר״מ` renders as מ״ר under the same quirk.
 */
const HEB_M2 = "\u05E8\u05F4\u05DE";

/**
 * Lower stripe on the LEFT column only — `תוכנית כיפוף` sits below חתך (profile), above the bend plan view.
 */
const BOTTOM_HEADER_T = TB_T;
const BOTTOM_HEADER_B = TB_T + VIEW_HEADER_H;

/** Left half: profile (חתך) — shortens when a bend plan strip is reserved below it. */
function leftPanelBounds(hasBendPlan = false): { l: number; t: number; r: number; b: number } {
  return {
    l: FL + 2,
    t: HEADER_B + 1,
    r: SHEET_DIVIDER_X - SPLIT_GAP / 2 - 1,
    b: hasBendPlan ? BOTTOM_HEADER_T - 2 : TOP_B - 2,
  };
}

/** Right half: flat pattern (פריסה) — full height above the title block row. */
function rightPanelBounds(): { l: number; t: number; r: number; b: number } {
  return {
    l: SHEET_DIVIDER_X + SPLIT_GAP / 2 + 1,
    t: HEADER_B + 1,
    r: FR - 2,
    b: TOP_B - 2,
  };
}

/** Bottom strip of the left column: bend plan below חתך. */
function leftBottomPanelBounds(): { l: number; t: number; r: number; b: number } {
  return {
    l: FL + 2,
    t: BOTTOM_HEADER_B + 1,
    r: SHEET_DIVIDER_X - SPLIT_GAP / 2 - 1,
    b: FB - 2,
  };
}

/** Full drawing area inside panel (titles live in shared header stripe above). */
function contentBoundsInPanel(panel: {
  l: number;
  t: number;
  r: number;
  b: number;
}): { l: number; t: number; r: number; b: number } {
  return {
    l: panel.l + 2,
    t: panel.t + 1,
    r: panel.r - 2,
    b: panel.b - 2,
  };
}

/** Shared top stripe: Hebrew view titles, centered in each column. */
function drawViewHeaderStripe(doc: jsPDF, hasBendPlan = false): void {
  const leftL = FL + 2;
  const leftR = SHEET_DIVIDER_X - SPLIT_GAP / 2 - 1;
  const rightL = SHEET_DIVIDER_X + SPLIT_GAP / 2 + 1;
  const rightR = FR - 2;
  const leftCx = (leftL + leftR) / 2;
  const rightCx = (rightL + rightR) / 2;
  const headerMidY = TOP_T + VIEW_HEADER_H / 2;

  doc.setLineWidth(GEO_LINE_MM);
  doc.setDrawColor(0);
  doc.line(FL, HEADER_B, FR, HEADER_B);

  setHebFont(doc, VIEW_TITLE_FONT_SIZE);
  doc.setTextColor(0);
  doc.text(heb("חתך"), leftCx, headerMidY, {
    align: "center",
    baseline: "middle",
  });
  doc.text(heb("פריסה"), rightCx, headerMidY, {
    align: "center",
    baseline: "middle",
  });

  if (hasBendPlan) {
    doc.setLineWidth(GEO_LINE_MM);
    doc.setDrawColor(0);
    doc.line(FL, BOTTOM_HEADER_T, SHEET_DIVIDER_X, BOTTOM_HEADER_T);
    doc.line(FL, BOTTOM_HEADER_B, SHEET_DIVIDER_X, BOTTOM_HEADER_B);

    const midY = (BOTTOM_HEADER_T + BOTTOM_HEADER_B) / 2;
    setHebFont(doc, VIEW_TITLE_FONT_SIZE);
    doc.setTextColor(0);
    doc.text(heb("תוכנית כיפוף"), leftCx, midY, {
      align: "center",
      baseline: "middle",
    });
  }
}

/** Vertical separator at title-block left edge: frame top → bottom. */
function drawSheetVerticalDivider(doc: jsPDF): void {
  doc.setDrawColor(0);
  doc.setLineWidth(GEO_LINE_MM);
  doc.line(SHEET_DIVIDER_X, FT, SHEET_DIVIDER_X, FB);
}

// ---------------------------------------------------------------------------
// Font loading + caching (TTF — jsPDF requires TTF, not woff)
// ---------------------------------------------------------------------------

/** Base64 TTF — Latin, digits, symbols (no Hebrew in this hinted build). */
let fontCacheLatin: string | null = null;
/** Base64 TTF — Hebrew script (use with {@link setHebFont}). */
let fontCacheHebrew: string | null = null;

const SHEET_FONT_LATIN = "NotoSans";
const SHEET_FONT_HEBREW = "NotoSansHebrew";

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function loadFont(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return arrayBufferToBase64(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function ensureFonts(): Promise<void> {
  if (!fontCacheLatin) {
    fontCacheLatin = await loadFont("/fonts/NotoSans-Regular.ttf");
  }
  if (!fontCacheHebrew) {
    fontCacheHebrew = await loadFont("/fonts/NotoSansHebrew-Regular.ttf");
  }
}

function registerFonts(doc: jsPDF): boolean {
  if (!fontCacheLatin || !fontCacheHebrew) return false;
  doc.addFileToVFS("NotoSans-Regular.ttf", fontCacheLatin);
  doc.addFont("NotoSans-Regular.ttf", SHEET_FONT_LATIN, "normal");
  doc.addFileToVFS("NotoSansHebrew-Regular.ttf", fontCacheHebrew);
  doc.addFont("NotoSansHebrew-Regular.ttf", SHEET_FONT_HEBREW, "normal");
  return true;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function heb(s: string): string {
  return s.split("").reverse().join("");
}

function setHebFont(doc: jsPDF, size: number, _bold = false): void {
  try {
    doc.setFont(SHEET_FONT_HEBREW, "normal");
  } catch {
    doc.setFont("helvetica", "normal");
  }
  doc.setFontSize(size);
}

function setLatFont(doc: jsPDF, size: number, _bold = false): void {
  try {
    doc.setFont(SHEET_FONT_LATIN, "normal");
  } catch {
    doc.setFont("helvetica", "normal");
  }
  doc.setFontSize(size);
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

/** All geometry and dimensions render in black. */
const STROKE_RGB: [number, number, number] = [0, 0, 0];
const DIM_RGB: [number, number, number] = [0, 0, 0];
/** Unified stroke width (mm): geometry, dimensions, frames, headers, title block, sheet border. */
const GEO_LINE_MM = 0.45;

/** Filled arrow: tip at witness/dimension intersection, base inside along the dim line. */
const DIM_ARROW_DEPTH_MM = 2.05;
const DIM_ARROW_HALF_WIDTH_MM = 0.88;

/**
 * Desired visual distance (mm) from the dimension line to the text visual center.
 * The anchor is computed per-call to compensate for the rotation-dependent
 * baseline-to-center offset so the rendered gap is identical for ALL angles.
 */
const DIM_VISUAL_GAP_MM = 3.0;

/**
 * Approximate half-ascent of the font in mm, given fontSize in pt.
 * Noto Sans: approximate Latin/hebrew ascent for label offset (~70 % of em).
 */
const HALF_ASCENT_FACTOR = 0.352778 * 0.35;

/** Dash pattern for dimension line (mm units). */
const DIM_LINE_DASH = [1.15, 0.95] as [number, number];

/** Profile angle arc radius is scaled down (÷ this) vs the computed layout radius. */
const ANGLE_ARC_RADIUS_DIVISOR = 1.25;

/**
 * Radial offset (mm) from arc radius to angle label center along the bisector — must clear
 * arc stroke and typical glyph box; larger than old 2.5 mm to avoid text crossing the arc.
 */
const ANGLE_LABEL_RADIAL_CLEAR_MM = 5.8;

function drawFilledDimArrowInward(
  doc: jsPDF,
  tipX: number,
  tipY: number,
  inwardUx: number,
  inwardUy: number
): void {
  const d = DIM_ARROW_DEPTH_MM;
  const hw = DIM_ARROW_HALF_WIDTH_MM;
  const px = -inwardUy;
  const py = inwardUx;
  const bx = tipX + inwardUx * d;
  const by = tipY + inwardUy * d;
  const b1x = bx + px * hw;
  const b1y = by + py * hw;
  const b2x = bx - px * hw;
  const b2y = by - py * hw;
  doc.setFillColor(DIM_RGB[0], DIM_RGB[1], DIM_RGB[2]);
  doc.triangle(tipX, tipY, b1x, b1y, b2x, b2y, "F");
}

/** Plain string, or mm value rendered as Latin digits + Hebrew מ"מ (no bidi reversal). */
type DimensionLabel = string | { mmHebrew: number };

/**
 * Linear dimension: extension lines, dimension line, label outside the part — same idea as
 * `ProfilePreview2D` (normal points away from centroid). Label rotated parallel to the
 * measurement line, readable (±90°).
 */
function drawDimension(
  doc: jsPDF,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: DimensionLabel,
  offsetMag: number,
  fontSize: number,
  centroid: { x: number; y: number }
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  let nx = -dy / len;
  let ny = dx / len;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  if (
    nx * (midX - centroid.x) + ny * (midY - centroid.y) <
    0
  ) {
    nx = -nx;
    ny = -ny;
  }

  const off = Math.abs(offsetMag);
  const ax = x1 + nx * off;
  const ay = y1 + ny * off;
  const bx = x2 + nx * off;
  const by = y2 + ny * off;

  const dimLen = Math.hypot(bx - ax, by - ay);
  const ux = dimLen > 1e-6 ? (bx - ax) / dimLen : 1;
  const uy = dimLen > 1e-6 ? (by - ay) / dimLen : 0;

  // Page coords are PDF-style (y down). Math.atan2(dy, dx) assumes y up, which skews
  // every sloped label; use atan2(-dy, dx) so the angle matches the dimension line.
  let angleDeg = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (angleDeg > 90) angleDeg -= 180;
  if (angleDeg < -90) angleDeg += 180;

  const dimMidX = (ax + bx) / 2;
  const dimMidY = (ay + by) / 2;

  doc.setLineWidth(GEO_LINE_MM);
  doc.setDrawColor(DIM_RGB[0], DIM_RGB[1], DIM_RGB[2]);

  doc.setLineDashPattern([0.7, 1.1], 0);
  doc.line(x1, y1, ax, ay);
  doc.line(x2, y2, bx, by);
  doc.setLineDashPattern([], 0);

  const trim = Math.min(DIM_ARROW_DEPTH_MM + 0.15, dimLen * 0.42);
  let sx = ax + ux * trim;
  let sy = ay + uy * trim;
  let ex = bx - ux * trim;
  let ey = by - uy * trim;
  if (Math.hypot(ex - sx, ey - sy) < 1.2) {
    sx = ax;
    sy = ay;
    ex = bx;
    ey = by;
  }

  doc.setLineDashPattern(DIM_LINE_DASH, 0);
  doc.line(sx, sy, ex, ey);
  doc.setLineDashPattern([], 0);

  drawFilledDimArrowInward(doc, ax, ay, ux, uy);
  drawFilledDimArrowInward(doc, bx, by, -ux, -uy);

  doc.setTextColor(DIM_RGB[0], DIM_RGB[1], DIM_RGB[2]);

  // jsPDF's align:"center" shifts x in PAGE coords, which is wrong for rotated
  // text (it shifts perpendicular to the run instead of along it).  We manually
  // center along the run direction and offset from the dim line in the normal
  // direction, with a baseline-to-visual-center correction for the rotation.
  const h = fontSize * HALF_ASCENT_FACTOR;
  const aRad = angleDeg * Math.PI / 180;
  const cosA = Math.cos(aRad);
  const sinA = Math.sin(aRad);

  const baseX = h * sinA;
  const baseY = h * cosA;

  const midOffX = dimMidX + nx * DIM_VISUAL_GAP_MM + baseX;
  const midOffY = dimMidY + ny * DIM_VISUAL_GAP_MM + baseY;

  if (typeof label === "object") {
    const num = label.mmHebrew.toFixed(1);
    const gap = 1.15;
    setLatFont(doc, fontSize);
    const twN = doc.getTextWidth(num);
    setHebFont(doc, fontSize);
    const twU = doc.getTextWidth(HEB_MM);
    const tw = twN + gap + twU;
    const runCenterX = -(tw / 2) * cosA;
    const runCenterY = (tw / 2) * sinA;
    const startX = midOffX + runCenterX;
    const startY = midOffY + runCenterY;
    setHebFont(doc, fontSize);
    doc.text(HEB_MM, startX, startY, { angle: angleDeg });
    setLatFont(doc, fontSize);
    doc.text(num, startX + (twU + gap) * cosA, startY - (twU + gap) * sinA, {
      angle: angleDeg,
    });
  } else {
    setLatFont(doc, fontSize);
    const tw = doc.getTextWidth(label);
    const runCenterX = -(tw / 2) * cosA;
    const runCenterY = (tw / 2) * sinA;
    const labelX = midOffX + runCenterX;
    const labelY = midOffY + runCenterY;
    doc.text(label, labelX, labelY, {
      angle: angleDeg,
    });
  }
  doc.setTextColor(0);
  doc.setDrawColor(0);
}

function drawAngleArc(
  doc: jsPDF,
  cx: number,
  cy: number,
  startAngle: number,
  endAngle: number,
  radius: number,
  label: string,
  fontSize = 11
): void {
  let sa = startAngle;
  let ea = endAngle;
  if (ea < sa) ea += 2 * Math.PI;
  // Always draw the shorter arc (interior angle, ≤ π)
  if (ea - sa > Math.PI) {
    const tmp = sa;
    sa = ea;
    ea = tmp + 2 * Math.PI;
  }
  const steps = Math.max(16, Math.ceil(((ea - sa) * 180) / Math.PI));
  doc.setLineWidth(GEO_LINE_MM);
  doc.setDrawColor(DIM_RGB[0], DIM_RGB[1], DIM_RGB[2]);
  for (let i = 0; i < steps; i++) {
    const a1 = sa + ((ea - sa) * i) / steps;
    const a2 = sa + ((ea - sa) * (i + 1)) / steps;
    doc.line(
      cx + Math.cos(a1) * radius,
      cy + Math.sin(a1) * radius,
      cx + Math.cos(a2) * radius,
      cy + Math.sin(a2) * radius
    );
  }
  const ma = (sa + ea) / 2;
  const labelR = radius + ANGLE_LABEL_RADIAL_CLEAR_MM;
  const lx = cx + Math.cos(ma) * labelR;
  const ly = cy + Math.sin(ma) * labelR;
  setLatFont(doc, fontSize);
  doc.setTextColor(DIM_RGB[0], DIM_RGB[1], DIM_RGB[2]);
  // Center on bisector outside the arc (align:center only; no rotation here).
  doc.text(label, lx, ly, { align: "center", baseline: "middle" });
  doc.setTextColor(0);
  doc.setDrawColor(0);
}

// ---------------------------------------------------------------------------
// Profile (section) view — חתך צד — right panel
// ---------------------------------------------------------------------------

function drawProfileView(
  doc: jsPDF,
  pts: Point2[],
  straights: number[],
  angles: number[],
  panel: { l: number; t: number; r: number; b: number }
): void {
  if (pts.length < 2) return;

  const cx = (panel.l + panel.r) / 2;

  const inner = contentBoundsInPanel(panel);

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const geoW = maxX - minX || 1;
  const geoH = maxY - minY || 1;

  const areaW = inner.r - inner.l;
  const areaH = inner.b - inner.t;
  const dimSpace = Math.min(16, Math.max(8, Math.min(areaW, areaH) * 0.12));
  const drawW = Math.max(4, areaW - dimSpace * 2);
  const drawH = Math.max(4, areaH - dimSpace * 2);

  const scale = Math.min(drawW / geoW, drawH / geoH) * 0.97;
  const ox =
    inner.l + areaW / 2 - (geoW * scale) / 2 - minX * scale;
  const oy =
    inner.t + areaH / 2 + (geoH * scale) / 2 + minY * scale;

  const tx = (p: Point2) => ox + p.x * scale;
  const ty = (p: Point2) => oy - p.y * scale;

  let tcx = 0;
  let tcy = 0;
  for (const p of pts) {
    tcx += tx(p);
    tcy += ty(p);
  }
  tcx /= pts.length;
  tcy /= pts.length;
  const centroid = { x: tcx, y: tcy };

  doc.setLineWidth(GEO_LINE_MM);
  doc.setDrawColor(STROKE_RGB[0], STROKE_RGB[1], STROKE_RGB[2]);
  for (let i = 0; i < pts.length - 1; i++) {
    doc.line(tx(pts[i]), ty(pts[i]), tx(pts[i + 1]), ty(pts[i + 1]));
  }
  doc.setDrawColor(0);

  const dimOff = Math.min(8, Math.max(4, dimSpace * 0.45));
  const dimFont = Math.min(13, Math.max(10, areaW * 0.044));
  for (let i = 0; i < pts.length - 1 && i < straights.length; i++) {
    if (straights[i] <= 0) continue;
    const label = `${Math.round(straights[i] * 10) / 10}`;
    const seg_dx = pts[i + 1].x - pts[i].x;
    const seg_dy = pts[i + 1].y - pts[i].y;
    const segLen = Math.hypot(seg_dx, seg_dy);
    if (segLen < 0.01) continue;

    drawDimension(
      doc,
      tx(pts[i]),
      ty(pts[i]),
      tx(pts[i + 1]),
      ty(pts[i + 1]),
      label,
      dimOff,
      dimFont,
      centroid
    );
  }

  const arcR =
    Math.min(14, Math.max(6, Math.min(areaW, areaH) * 0.14)) /
    ANGLE_ARC_RADIUS_DIVISOR;
  for (let i = 0; i < angles.length && i + 1 < pts.length - 1; i++) {
    const B = pts[i + 1];
    const angleDeg = angles[i];
    if (angleDeg < 0.5 || angleDeg > 179.5) continue;

    const vIn = { x: pts[i].x - B.x, y: pts[i].y - B.y };
    const vOut = { x: pts[i + 2].x - B.x, y: pts[i + 2].y - B.y };
    const aInScreen = Math.atan2(-vIn.y, vIn.x);
    const aOutScreen = Math.atan2(-vOut.y, vOut.x);

    drawAngleArc(
      doc,
      tx(B),
      ty(B),
      Math.min(aInScreen, aOutScreen),
      Math.max(aInScreen, aOutScreen),
      arcR,
      `${Math.round(angleDeg)}°`,
      11
    );
  }
}

// ---------------------------------------------------------------------------
// Flat blank view — חתך פריסה - מבט על — left panel
// ---------------------------------------------------------------------------

function drawFlatBlankView(
  doc: jsPDF,
  blankL: number,
  blankW: number,
  straights: number[],
  bends: number[],
  thicknessMm: number,
  materialType: MaterialType,
  panel: { l: number; t: number; r: number; b: number },
  holePolysMm: Point2[][] | null
): void {
  if (blankL <= 0 || blankW <= 0) return;

  const inner = contentBoundsInPanel(panel);
  const areaW = inner.r - inner.l;
  const areaH = inner.b - inner.t;
  const dimSpace = Math.min(14, Math.max(7, Math.min(areaW, areaH) * 0.1));
  /** Keep scale caption inside inner bounds so geometry stays visually centered in the panel. */
  const scaleNoteReserve = 6;
  const topFree = inner.t + dimSpace;
  const bottomFree = inner.b - dimSpace - scaleNoteReserve;
  const availW = Math.max(4, areaW - dimSpace * 2);
  const availH = Math.max(4, bottomFree - topFree);

  const scale = Math.min(availW / blankL, availH / blankW) * 0.98;
  const rectW = blankL * scale;
  const rectH = blankW * scale;
  const cxInner = (inner.l + inner.r) / 2;
  const rx = cxInner - rectW / 2;
  const ry = topFree + (availH - rectH) / 2;

  doc.setLineWidth(GEO_LINE_MM);
  doc.setDrawColor(STROKE_RGB[0], STROKE_RGB[1], STROKE_RGB[2]);
  doc.rect(rx, ry, rectW, rectH);
  doc.setDrawColor(0);

  const blankCentroid = {
    x: rx + rectW / 2,
    y: ry + rectH / 2,
  };
  const dOff = Math.min(5, Math.max(3, dimSpace * 0.35));
  const dimFont = Math.min(12, Math.max(10, areaW * 0.04));
  drawDimension(
    doc,
    rx,
    ry + rectH + 1,
    rx + rectW,
    ry + rectH + 1,
    `${Math.round(blankL * 10) / 10}`,
    dOff,
    dimFont,
    blankCentroid
  );
  drawDimension(
    doc,
    rx - 1,
    ry,
    rx - 1,
    ry + rectH,
    `${Math.round(blankW * 10) / 10}`,
    dOff,
    dimFont,
    blankCentroid
  );

  if (bends.length > 0 && straights.length > 1) {
    const insideRadiusMm = thicknessMm;
    const kFactor = kFactorForMaterial(materialType);
    const ossbs = bends.map((a) =>
      outsideSetbackMm(a, insideRadiusMm, thicknessMm)
    );

    doc.setLineWidth(GEO_LINE_MM);
    doc.setDrawColor(0, 0, 0);
    let curX = 0;

    for (let i = 0; i < bends.length; i++) {
      let flatRun = straights[i] ?? 0;
      if (i > 0) flatRun -= ossbs[i - 1];
      flatRun -= ossbs[i];
      curX += Math.max(0, flatRun);

      const ba = bendAllowanceMm(bends[i], insideRadiusMm, thicknessMm, kFactor);
      const bendCX = curX + ba / 2;
      const px = rx + bendCX * scale;

      doc.setLineDashPattern([1.2, 1.0], 0);
      doc.line(px, ry, px, ry + rectH);
      doc.setLineDashPattern([], 0);

      curX += ba;
    }
    doc.setDrawColor(0);
  }

  if (holePolysMm && holePolysMm.length > 0) {
    doc.setLineWidth(GEO_LINE_MM);
    doc.setDrawColor(0, 0, 0);
    for (const loop of holePolysMm) {
      if (loop.length < 3) continue;
      const n = loop.length;
      for (let i = 0; i < n; i++) {
        const a = loop[i]!;
        const b = loop[(i + 1) % n]!;
        const x0 = rx + a.x * scale;
        const y0 = ry + rectH - a.y * scale;
        const x1 = rx + b.x * scale;
        const y1 = ry + rectH - b.y * scale;
        doc.line(x0, y0, x1, y1);
      }
    }
  }
}

/** Simple side strip for flat plate / manual rect — right panel when no bent profile */
function drawFlatSideStripView(
  doc: jsPDF,
  lengthMm: number,
  thicknessMm: number,
  panel: { l: number; t: number; r: number; b: number }
): void {
  const cx = (panel.l + panel.r) / 2;

  const inner = contentBoundsInPanel(panel);
  const L = Math.max(1, lengthMm);
  const t = Math.max(0.5, thicknessMm);
  const areaW = inner.r - inner.l;
  const areaH = inner.b - inner.t;
  const dimSpace = Math.min(14, Math.max(7, Math.min(areaW, areaH) * 0.1));
  const drawW = Math.max(4, areaW - dimSpace * 2);
  const drawH = Math.max(4, areaH - dimSpace * 2);
  const scale = Math.min(drawW / L, drawH / t) * 0.97;
  const rw = L * scale;
  const rh = t * scale;
  const rx = inner.l + areaW / 2 - rw / 2;
  const ry = inner.t + areaH / 2 - rh / 2;

  doc.setLineWidth(GEO_LINE_MM);
  doc.setDrawColor(STROKE_RGB[0], STROKE_RGB[1], STROKE_RGB[2]);
  doc.rect(rx, ry, rw, rh);
  doc.setDrawColor(0);

  const stripCentroid = { x: rx + rw / 2, y: ry + rh / 2 };
  const stripDimFont = Math.min(12, Math.max(10, areaW * 0.04));
  drawDimension(
    doc,
    rx,
    ry - 1,
    rx + rw,
    ry - 1,
    `${Math.round(L * 10) / 10}`,
    4,
    stripDimFont,
    stripCentroid
  );
  drawDimension(
    doc,
    rx + rw + 1,
    ry,
    rx + rw + 1,
    ry + rh,
    `${Math.round(t * 10) / 10}`,
    4,
    stripDimFont,
    stripCentroid
  );

}

// ---------------------------------------------------------------------------
// Bend plan (flat) — תוכנית כיפוף — left-bottom panel (below חתך)
// ---------------------------------------------------------------------------

/**
 * Returns +1 (CCW), −1 (CW), or 0 (collinear) for the bend at `pts[bendIndex+1]`.
 * Sign is computed from the 2D cross of consecutive edges in the profile polyline.
 */
function bendTurnSign(pts: Point2[], bendIndex: number): 1 | -1 | 0 {
  const i = bendIndex + 1;
  if (i < 1 || i >= pts.length - 1) return 0;
  const ax = pts[i].x - pts[i - 1].x;
  const ay = pts[i].y - pts[i - 1].y;
  const bx = pts[i + 1].x - pts[i].x;
  const by = pts[i + 1].y - pts[i].y;
  const cross = ax * by - ay * bx;
  if (cross > 1e-6) return 1;
  if (cross < -1e-6) return -1;
  return 0;
}

/** Small filled equilateral triangle for direction (up/down) indicator. */
function drawDirectionTriangle(
  doc: jsPDF,
  cx: number,
  cy: number,
  size: number,
  up: boolean
): void {
  doc.setFillColor(DIM_RGB[0], DIM_RGB[1], DIM_RGB[2]);
  const h = size;
  const w = size * 0.9;
  if (up) {
    doc.triangle(
      cx - w / 2,
      cy + h / 2,
      cx + w / 2,
      cy + h / 2,
      cx,
      cy - h / 2,
      "F"
    );
  } else {
    doc.triangle(
      cx - w / 2,
      cy - h / 2,
      cx + w / 2,
      cy - h / 2,
      cx,
      cy + h / 2,
      "F"
    );
  }
}

/** Centered at `cx`: `מ"מ` left, then `123.4` (two runs, no mixed-string bidi). */
function drawMmLabelCentered(
  doc: jsPDF,
  cx: number,
  y: number,
  valueMm: number,
  fontSize: number
): void {
  const num = valueMm.toFixed(1);
  const gap = 1.15;
  setLatFont(doc, fontSize);
  const twN = doc.getTextWidth(num);
  setHebFont(doc, fontSize);
  const twU = doc.getTextWidth(HEB_MM);
  const total = twN + gap + twU;
  const x0 = cx - total / 2;
  setHebFont(doc, fontSize);
  doc.text(HEB_MM, x0, y, { baseline: "middle" });
  setLatFont(doc, fontSize);
  doc.text(num, x0 + twU + gap, y, { baseline: "middle" });
}

/** mm label with the block’s right edge at `rightX` (e.g. start “0” left of the strip). */
function drawMmLabelRightAligned(
  doc: jsPDF,
  rightX: number,
  y: number,
  valueMm: number,
  fontSize: number
): void {
  const num = valueMm.toFixed(1);
  const gap = 1.15;
  setLatFont(doc, fontSize);
  const twN = doc.getTextWidth(num);
  setHebFont(doc, fontSize);
  const twU = doc.getTextWidth(HEB_MM);
  const total = twN + gap + twU;
  const x0 = rightX - total;
  setHebFont(doc, fontSize);
  doc.text(HEB_MM, x0, y, { baseline: "middle" });
  setLatFont(doc, fontSize);
  doc.text(num, x0 + twU + gap, y, { baseline: "middle" });
}

/** mm label with the block’s left edge at `leftX` (e.g. total length right of the strip). */
function drawMmLabelLeftAligned(
  doc: jsPDF,
  leftX: number,
  y: number,
  valueMm: number,
  fontSize: number
): void {
  const num = valueMm.toFixed(1);
  const gap = 1.15;
  setHebFont(doc, fontSize);
  const twU = doc.getTextWidth(HEB_MM);
  const x0 = leftX;
  setHebFont(doc, fontSize);
  doc.text(HEB_MM, x0, y, { baseline: "middle" });
  setLatFont(doc, fontSize);
  doc.text(num, x0 + twU + gap, y, { baseline: "middle" });
}

/** Width (mm) of the `מ"מ` + number block — used to reserve horizontal space at strip ends. */
function mmLabelBlockWidth(
  doc: jsPDF,
  valueMm: number,
  fontSize: number
): number {
  const num = valueMm.toFixed(1);
  const gap = 1.15;
  setLatFont(doc, fontSize);
  const twN = doc.getTextWidth(num);
  setHebFont(doc, fontSize);
  const twU = doc.getTextWidth(HEB_MM);
  return twN + gap + twU;
}

/**
 * Bend execution plan rendered as the DEVELOPED (flat) blank: horizontal strip with a
 * perpendicular bend line at each bend's centerline, and a 3-line callout stacked above it:
 *   dim   (distance along the flat blank from start edge, mm)
 *   deg   (included angle at bend, ° — same as profile view, not path turn)
 *   dir   (▲ for "up" = CW turn sign, ▼ for "down" = CCW turn sign)
 */
function drawBendPlanFlatView(
  doc: jsPDF,
  pts: Point2[],
  blankL: number,
  straights: number[],
  bends: number[],
  /** One internal angle (°) per bend — from {@link internalAnglesFromPolyline}, matches חתך צד */
  internalAnglesDeg: number[],
  thicknessMm: number,
  materialType: MaterialType,
  panel: { l: number; t: number; r: number; b: number }
): void {
  if (blankL <= 0 || bends.length === 0 || straights.length < 2) return;

  const inner = contentBoundsInPanel(panel);
  const areaW = inner.r - inner.l;
  const areaH = inner.b - inner.t;
  if (areaW < 20 || areaH < 15) return;

  // Label size first — endpoint mm labels sit to the left/right of the strip; reserve
  // enough horizontal margin so they stay inside the panel (same font as bend callouts).
  const labelFont = Math.min(11.25, Math.max(8.75, areaW * 0.035));
  const epGap = 1.8;
  const borderMargin = 2;
  const wStart = mmLabelBlockWidth(doc, 0, labelFont);
  const wEnd = mmLabelBlockWidth(doc, blankL, labelFont);
  const sidePad = Math.max(wStart, wEnd) + epGap + borderMargin;
  const availW = Math.max(4, areaW - sidePad * 2);
  const scale = availW / blankL;
  const stripW = blankL * scale;

  // Plate is rendered as a single horizontal line (no plate rectangle) — the operator reads
  // numbers from the callouts, the line is just a reference axis for position.
  // blankDimSpace: room below the line for the overall length dimension.
  const blankDimSpace = 15;
  const cxInner = (inner.l + inner.r) / 2;
  const rx = cxInner - stripW / 2;
  const lineY = inner.b - blankDimSpace;

  doc.setLineWidth(GEO_LINE_MM);
  doc.setDrawColor(STROKE_RGB[0], STROKE_RGB[1], STROKE_RGB[2]);
  doc.line(rx, lineY, rx + stripW, lineY);
  doc.setDrawColor(0);

  // Bend positions on the flat blank — same math as the flat-blank view:
  //   flatRun(i) = straights[i] − ossb(i−1) − ossb(i)
  //   bendCenter(i) = Σ flatRun(0..i) + Σ bendAllowance(0..i−1) + bendAllowance(i)/2
  const insideRadiusMm = thicknessMm;
  const kFactor = kFactorForMaterial(materialType);
  const ossbs = bends.map((a) =>
    outsideSetbackMm(a, insideRadiusMm, thicknessMm)
  );

  const bendCenters: number[] = [];
  let curX = 0;
  for (let i = 0; i < bends.length; i++) {
    let flatRun = straights[i] ?? 0;
    if (i > 0) flatRun -= ossbs[i - 1];
    flatRun -= ossbs[i];
    curX += Math.max(0, flatRun);
    const ba = bendAllowanceMm(bends[i], insideRadiusMm, thicknessMm, kFactor);
    bendCenters.push(curX + ba / 2);
    curX += ba;
  }

  const lineH = labelFont * 0.352778 * 1.25;

  // Visual geometry around the reference line.
  const tickHalf = Math.max(1.4, lineH * 0.55);
  // Generous padding between the triangle and the adjacent text lines / reference line.
  const arrowGap = Math.max(2.4, lineH * 0.7);

  // Stack layout (bottom → top): triangle (direction), deg, dim. Positions are Y-centers.
  const arrowSize = Math.min(lineH * 1.0, 3.8);
  const dirY = lineY - tickHalf - arrowGap - arrowSize / 2;
  const degY = dirY - arrowSize / 2 - arrowGap;
  const dimY = degY - lineH;

  for (let i = 0; i < bends.length; i++) {
    const px = rx + bendCenters[i] * scale;

    // Bend tick + leader — one continuous segment from reference line to callout stack.
    doc.setLineWidth(GEO_LINE_MM);
    doc.setDrawColor(STROKE_RGB[0], STROKE_RGB[1], STROKE_RGB[2]);
    doc.line(px, lineY + tickHalf, px, dirY + arrowSize / 2 + 0.4);

    // Direction triangle — user convention: up = CW turn sign (−1), down = CCW (+1).
    const sign = bendTurnSign(pts, i);
    if (sign !== 0) {
      drawDirectionTriangle(doc, px, dirY, arrowSize, sign < 0);
    }

    setLatFont(doc, labelFont);
    doc.setTextColor(DIM_RGB[0], DIM_RGB[1], DIM_RGB[2]);
    const inclDeg =
      internalAnglesDeg[i] ??
      Math.max(0, 180 - Math.abs(bends[i] ?? 0));
    doc.text(`${Math.round(inclDeg)}\u00B0`, px, degY, {
      align: "center",
      baseline: "middle",
    });
    drawMmLabelCentered(doc, px, dimY, bendCenters[i], labelFont);
    doc.setTextColor(0);
    doc.setDrawColor(0);
  }

  // Start / end reference labels — same vertical band as the plate line, to the left of
  // the start and to the right of the end (not below the line).

  setLatFont(doc, labelFont);
  doc.setTextColor(DIM_RGB[0], DIM_RGB[1], DIM_RGB[2]);
  drawMmLabelRightAligned(doc, rx - epGap, lineY, 0, labelFont);
  drawMmLabelLeftAligned(doc, rx + stripW + epGap, lineY, blankL, labelFont);
  doc.setTextColor(0);
  doc.setDrawColor(0);

  // Overall developed length: witness points on the plate line so extension lines run from
  // the real ends down to the dashed dimension line (offsetMag below the feature), label outside.
  const blankDimFont = Math.min(10, Math.max(8, areaW * 0.03));
  const stripCentroid = { x: rx + stripW / 2, y: lineY };
  /** Vertical gap from plate line to total dim line (was 3 mm; ×1.25 for clearer separation). */
  const bendPlanTotalDimOffsetMm = 3 * 1.25;
  drawDimension(
    doc,
    rx,
    lineY,
    rx + stripW,
    lineY,
    { mmHebrew: blankL },
    bendPlanTotalDimOffsetMm,
    blankDimFont,
    stripCentroid
  );
}

// ---------------------------------------------------------------------------
// Title block — 2×6 grid, Hebrew RTL (one label + one value per half-row)
// ---------------------------------------------------------------------------

const TB_GRID_LINE_MM = Math.max(GEO_LINE_MM * 1.2, 0.52);

/** Hebrew shape names — aligned with `messages/he.json` bendPlatePhase.template.*.name */
const BEND_TEMPLATE_LABEL_HE: Record<BendTemplateId, string> = {
  l: "זוית",
  u: "תעלה",
  z: "מדרגה",
  omega: "אומגה",
  gutter: "מרזב",
  plate: "ריבוע",
  custom: "מותאם אישית",
};

function titleGeometryLabel(
  part: QuotePartRow,
  bendItem: BendPlateQuoteItem | null
): string {
  if (bendItem) return BEND_TEMPLATE_LABEL_HE[bendItem.template];
  const tid = part.bendTemplateId;
  if (tid && tid in BEND_TEMPLATE_LABEL_HE) {
    return BEND_TEMPLATE_LABEL_HE[tid as BendTemplateId];
  }
  return "ריבוע";
}

function drawTitleBlock(
  doc: jsPDF,
  partName: string,
  material: string,
  thicknessMm: number,
  plateWidthMm: number,
  weightKg: number,
  quantity: number,
  finish: string,
  materialType: MaterialType,
  areaM2: number,
  geometryLabel: string,
  quoteReference: string,
  customerName?: string
): void {
  const rh = TB_ROW_H;
  const pad = 1.85;
  const fsLbl = 6.15;
  /** Value size: previous 2× step, then ÷1.25 per layout request. */
  const fsVal = 10.8;
  const TB_R = TB_L + TB_W;

  const todayIso = new Date().toISOString().slice(0, 10);
  const today = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(todayIso);
    if (!m) return todayIso;
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  })();
  const finishDisplay =
    finish && finish !== "ללא" ? finish : "-";
  const matTypeHe = MATERIAL_TYPE_LABELS[materialType];
  const clientDisplay = customerName?.trim() || "—";
  const referenceDisplay = quoteReference.trim() || partName;

  doc.setLineWidth(TB_GRID_LINE_MM);
  doc.setDrawColor(0);
  doc.rect(TB_L, TB_T, TB_W, TB_H);
  for (let r = 1; r < 6; r++) {
    doc.line(TB_L, TB_T + rh * r, TB_R, TB_T + rh * r);
  }
  doc.line(TB_C1, TB_T, TB_C1, TB_T + TB_H);

  function lblTR(right: number, y: number, s: string): void {
    setHebFont(doc, fsLbl);
    doc.setTextColor(0);
    doc.text(heb(s), right, y, { align: "right", baseline: "middle" });
  }
  function valBL(left: number, y: number, s: string, bold = false): void {
    setLatFont(doc, fsVal, bold);
    doc.setTextColor(0);
    doc.text(s, left, y, { baseline: "middle" });
  }
  function valBLheb(left: number, y: number, s: string): void {
    setHebFont(doc, fsVal);
    doc.setTextColor(0);
    doc.text(heb(s), left, y, { baseline: "middle" });
  }
  const GAP_UNIT_NUM = 1.25;
  /** Hebrew unit then Latin digits — separate `doc.text` + fonts; no LRM (U+200E) — it can draw as a stray mark in PDF. */
  function valMm(left: number, y: number, mm: number): void {
    const num =
      Math.abs(mm - Math.round(mm)) < 1e-6
        ? `${Math.round(mm)}`
        : (Math.round(mm * 10) / 10).toFixed(1);
    setHebFont(doc, fsVal);
    const twU = doc.getTextWidth(HEB_MM);
    doc.text(HEB_MM, left, y, { baseline: "middle" });
    setLatFont(doc, fsVal);
    doc.text(num, left + twU + GAP_UNIT_NUM, y, { baseline: "middle" });
  }
  /** `ק״ג` left, then Latin number. */
  function valKg(left: number, y: number, kg: number): void {
    if (kg <= 0) {
      valBL(left, y, "-");
      return;
    }
    const num = `${Math.round(kg * 1000) / 1000}`;
    setHebFont(doc, fsVal);
    const twU = doc.getTextWidth(HEB_KG);
    doc.text(HEB_KG, left, y, { baseline: "middle" });
    setLatFont(doc, fsVal);
    doc.text(num, left + twU + GAP_UNIT_NUM, y, { baseline: "middle" });
  }
  /** `מ״ר` left, then Latin number. */
  function valM2(left: number, y: number, m2: number): void {
    if (m2 <= 0) {
      valBL(left, y, "-");
      return;
    }
    const num = `${Math.round(m2 * 1000) / 1000}`;
    setHebFont(doc, fsVal);
    const twU = doc.getTextWidth(HEB_M2);
    doc.text(HEB_M2, left, y, { baseline: "middle" });
    setLatFont(doc, fsVal);
    doc.text(num, left + twU + GAP_UNIT_NUM, y, { baseline: "middle" });
  }

  function rowY(top: number): { yL: number; yV: number } {
    return { yL: top + 2.5, yV: top + rh - 3.35 };
  }

  // Row 0 — left: סוג חומר; right: שם הלקוח
  {
    const top = TB_T;
    const { yL, yV } = rowY(top);
    lblTR(TB_C1 - pad, yL, "סוג חומר");
    valBLheb(TB_L + pad, yV, matTypeHe);
    lblTR(TB_R - pad, yL, "שם הלקוח");
    valBL(TB_C1 + pad, yV, clientDisplay);
  }

  // Row 1 — left: סיווג חומר; right: מספר חלק
  {
    const top = TB_T + rh;
    const { yL, yV } = rowY(top);
    lblTR(TB_C1 - pad, yL, "סיווג חומר");
    valBL(TB_L + pad, yV, material);
    lblTR(TB_R - pad, yL, "מספר חלק");
    valBL(TB_C1 + pad, yV, partName);
  }

  // Row 2 — left: גימור; right: עובי
  {
    const top = TB_T + rh * 2;
    const { yL, yV } = rowY(top);
    lblTR(TB_C1 - pad, yL, "גימור");
    if (finishDisplay === "-") valBL(TB_L + pad, yV, "-");
    else valBLheb(TB_L + pad, yV, finishDisplay);
    lblTR(TB_R - pad, yL, "עובי");
    valMm(TB_C1 + pad, yV, thicknessMm);
  }

  // Row 3 — left: תאריך; right: כמות
  {
    const top = TB_T + rh * 3;
    const { yL, yV } = rowY(top);
    lblTR(TB_C1 - pad, yL, "תאריך");
    valBL(TB_L + pad, yV, today);
    lblTR(TB_R - pad, yL, "כמות");
    valBL(TB_C1 + pad, yV, `${quantity}`);
  }

  // Row 4 — left: גאומטריה (זוית / תעלה / …); right: משקל
  {
    const top = TB_T + rh * 4;
    const { yL, yV } = rowY(top);
    lblTR(TB_C1 - pad, yL, "גאומטריה");
    valBLheb(TB_L + pad, yV, geometryLabel);
    lblTR(TB_R - pad, yL, "משקל");
    valKg(TB_C1 + pad, yV, weightKg);
  }

  // Row 5 — left: סימוכין (quote ref); right: שטח
  {
    const top = TB_T + rh * 5;
    const { yL, yV } = rowY(top);
    lblTR(TB_C1 - pad, yL, "סימוכין");
    valBL(TB_L + pad, yV, referenceDisplay);
    lblTR(TB_R - pad, yL, "שטח");
    valM2(TB_C1 + pad, yV, areaM2);
  }

  doc.setTextColor(0);
  doc.setDrawColor(0);
}

// ---------------------------------------------------------------------------
// Drawing border
// ---------------------------------------------------------------------------

function drawBorder(doc: jsPDF): void {
  doc.setLineWidth(GEO_LINE_MM);
  doc.setDrawColor(0);
  doc.rect(FL, FT, FW, FH);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type PlateDrawingExportMeta = {
  /** Shown under שם הלקוח when exporting from a quote. */
  customerName?: string;
  /** Quote reference (e.g. OM-0001) — shown under סימוכין. */
  quoteReference?: string;
};

export async function generatePlateDrawingPdf(
  part: QuotePartRow,
  bendItem: BendPlateQuoteItem | null,
  materialType: MaterialType,
  exportMeta?: PlateDrawingExportMeta
): Promise<Uint8Array | null> {
  try {
    await ensureFonts();

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    registerFonts(doc);

    drawBorder(doc);

    // Geometry must be resolved BEFORE header/panel layout so the `hasBendPlan` flag
    // can shrink the left panel and draw the lower stripe in one pass.
    let hasBendPlan = false;
    let bendGeometry: {
      formState: BendPlateFormState;
      pts: Point2[];
      straights: number[];
      bends: number[];
      angles: number[];
      isFlat: boolean;
    } | null = null;

    if (bendItem) {
      const formState: BendPlateFormState = {
        template: bendItem.template,
        global: bendItem.global,
        l: bendItem.l,
        u: bendItem.u,
        z: bendItem.z,
        omega: bendItem.omega,
        gutter: bendItem.gutter,
        plate: bendItem.plate,
        custom: bendItem.custom,
        segmentFaceHoles: bendItem.segmentFaceHoles ?? [],
      };
      const { pts, straights, bends } = buildForTemplate(
        formState.template,
        formState
      );
      const angles = internalAnglesFromPolyline(pts);
      const isFlat = bendItem.template === "plate";
      bendGeometry = { formState, pts, straights, bends, angles, isFlat };
      hasBendPlan = !isFlat && pts.length >= 3 && bends.length > 0;
    }

    drawViewHeaderStripe(doc, hasBendPlan);

    const pl = leftPanelBounds(hasBendPlan);
    const pr = rightPanelBounds();

    if (bendItem && bendGeometry) {
      const { pts, straights, bends, angles, isFlat, formState } = bendGeometry;

      if (!isFlat && pts.length >= 3) {
        drawProfileView(doc, pts, straights, angles, pl);
      } else {
        drawFlatSideStripView(
          doc,
          Math.max(
            bendItem.calc.blankLengthMm,
            bendItem.calc.blankWidthMm
          ),
          bendItem.global.thicknessMm,
          pl
        );
      }

      const holePolysMm = bendPlateHolePolygonsOnFlatBlankMm(
        formState,
        materialType
      );
      drawFlatBlankView(
        doc,
        bendItem.calc.blankLengthMm,
        bendItem.calc.blankWidthMm,
        straights,
        bends,
        bendItem.global.thicknessMm,
        materialType,
        pr,
        holePolysMm
      );

      if (hasBendPlan) {
        drawBendPlanFlatView(
          doc,
          pts,
          bendItem.calc.blankLengthMm,
          straights,
          bends,
          angles,
          bendItem.global.thicknessMm,
          materialType,
          leftBottomPanelBounds()
        );
      }

      const { grade, finish } = splitMaterialGradeAndFinish(
        bendItem.global.material
      );

      const geometryLabel = titleGeometryLabel(part, bendItem);
      const quoteRef =
        exportMeta?.quoteReference?.trim() || part.partName;
      // `bendItem.calc.weightKg` is line total (× qty); title block shows one plate (match `part.weightKg` / calc÷qty).
      const unitWeightKg =
        part.weightKg > 0
          ? part.weightKg
          : bendItem.calc.weightKg /
            Math.max(1, Math.floor(bendItem.global.quantity) || 1);
      drawTitleBlock(
        doc,
        part.partName,
        grade,
        bendItem.global.thicknessMm,
        bendItem.global.plateWidthMm,
        unitWeightKg,
        bendItem.global.quantity,
        finish || bendItem.global.finish || "",
        materialType,
        part.areaM2,
        geometryLabel,
        quoteRef,
        exportMeta?.customerName
      );
    } else {
      const L = Math.max(1, part.lengthMm);
      const W = Math.max(1, part.widthMm);
      drawFlatSideStripView(doc, Math.max(L, W), part.thicknessMm, pl);
      drawFlatBlankView(
        doc,
        L,
        W,
        [L, W, L, W],
        [],
        part.thicknessMm,
        materialType,
        pr,
        null
      );

      const { grade, finish } = splitMaterialGradeAndFinish(part.material);
      const geometryLabel = titleGeometryLabel(part, null);
      const quoteRef =
        exportMeta?.quoteReference?.trim() || part.partName;
      drawTitleBlock(
        doc,
        part.partName,
        grade,
        part.thicknessMm,
        part.widthMm,
        part.weightKg,
        part.qty,
        finish,
        materialType,
        part.areaM2,
        geometryLabel,
        quoteRef,
        exportMeta?.customerName
      );
    }

    drawSheetVerticalDivider(doc);

    const buf = doc.output("arraybuffer");
    return new Uint8Array(buf);
  } catch (e) {
    console.error("[generatePlateDrawingPdf]", e);
    return null;
  }
}
