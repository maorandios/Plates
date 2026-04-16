/**
 * Client-side technical-drawing PDF for each plate (bend or flat).
 *
 * A4 landscape, Hebrew RTL:
 *   Top stripe: section titles (חתך פריסה - מבט על | חתך צד)
 *   Below: vertical divider at title-block column TB_C1; left = flat pattern (full height);
 *   right = profile above title block + title block bottom-right
 *
 * Uses jsPDF + Rubik TTF from /fonts/.
 */

// Use browser ESM bundle — default "jspdf" resolves to node build under Turbopack and breaks (fflate Worker).
import jsPDF from "jspdf/dist/jspdf.es.min.js";
import type { BendPlateQuoteItem } from "@/features/quick-quote/bend-plate/types";
import type { QuotePartRow } from "@/features/quick-quote/types/quickQuote";
import type { MaterialType } from "@/types/materials";
import type { BendPlateFormState } from "@/features/quick-quote/bend-plate/types";
import {
  buildForTemplate,
  bendAllowanceMm,
  outsideSetbackMm,
  kFactorForMaterial,
  internalAnglesFromPolyline,
  type Point2,
} from "@/features/quick-quote/bend-plate/geometry";
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

const TB_W = 170;   // title block width
const TB_H = 56;    // title block height
const TB_L = FR - TB_W;
const TB_T = FB - TB_H;
/** Column rules inside title block */
const TB_C1 = TB_L + TB_W * 0.38;
const TB_C2 = TB_L + TB_W * 0.68;
/** Vertical divider = left edge of title block — splits פריסה (left) from חתך צד + info (right). */
const SHEET_DIVIDER_X = TB_L;

/** Gap between title block and drawing row */
const GAP_ABOVE_TB = 5;
/** Top of sheet content (inside frame) */
const TOP_T = FT + 2;
/** Upper stripe: section titles only — drawings start below */
const VIEW_HEADER_H = 14;
const HEADER_B = TOP_T + VIEW_HEADER_H;
/** Right-hand drawing (חתך צד) ends above title block; left column uses full height to FB */
const TOP_B = TB_T - GAP_ABOVE_TB;

/** Section titles in header (2× previous ~8 pt) */
const VIEW_TITLE_FONT_SIZE = 16;

/** Gap straddling vertical divider line */
const SPLIT_GAP = 0.8;

function leftPanelBounds(): { l: number; t: number; r: number; b: number } {
  return {
    l: FL + 2,
    t: HEADER_B + 1,
    r: SHEET_DIVIDER_X - SPLIT_GAP / 2 - 1,
    b: FB - 2,
  };
}

function rightPanelBounds(): { l: number; t: number; r: number; b: number } {
  return {
    l: SHEET_DIVIDER_X + SPLIT_GAP / 2 + 1,
    t: HEADER_B + 1,
    r: FR - 2,
    b: TOP_B - 2,
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
function drawViewHeaderStripe(doc: jsPDF): void {
  const leftL = FL + 2;
  const leftR = SHEET_DIVIDER_X - SPLIT_GAP / 2 - 1;
  const rightL = SHEET_DIVIDER_X + SPLIT_GAP / 2 + 1;
  const rightR = FR - 2;
  const leftCx = (leftL + leftR) / 2;
  const rightCx = (rightL + rightR) / 2;
  const headerMidY = TOP_T + VIEW_HEADER_H / 2;

  doc.setLineWidth(0.35);
  doc.setDrawColor(0);
  doc.line(FL, HEADER_B, FR, HEADER_B);

  setHebFont(doc, VIEW_TITLE_FONT_SIZE);
  doc.setTextColor(0);
  doc.text(heb("חתך פריסה - מבט על"), leftCx, headerMidY, {
    align: "center",
    baseline: "middle",
  });
  doc.text(heb("חתך צד"), rightCx, headerMidY, {
    align: "center",
    baseline: "middle",
  });
}

/** Vertical separator aligned with title-block column TB_C1: frame top → bottom. */
function drawSheetVerticalDivider(doc: jsPDF): void {
  doc.setDrawColor(0);
  doc.setLineWidth(0.45);
  doc.line(SHEET_DIVIDER_X, FT, SHEET_DIVIDER_X, FB);
}

// ---------------------------------------------------------------------------
// Font loading + caching (TTF — jsPDF requires TTF, not woff)
// ---------------------------------------------------------------------------

let fontCacheRegular: string | null = null;
let fontCacheBold: string | null = null;

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
  if (!fontCacheRegular) fontCacheRegular = await loadFont("/fonts/Rubik-Regular.ttf");
  if (!fontCacheBold) fontCacheBold = await loadFont("/fonts/Rubik-Bold.ttf");
}

function registerFonts(doc: jsPDF): boolean {
  let ok = false;
  if (fontCacheRegular) {
    doc.addFileToVFS("Rubik-Regular.ttf", fontCacheRegular);
    doc.addFont("Rubik-Regular.ttf", "Rubik", "normal");
    ok = true;
  }
  if (fontCacheBold) {
    doc.addFileToVFS("Rubik-Bold.ttf", fontCacheBold);
    doc.addFont("Rubik-Bold.ttf", "Rubik", "bold");
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function heb(s: string): string {
  return s.split("").reverse().join("");
}

function setHebFont(doc: jsPDF, size: number, bold = false): void {
  try {
    doc.setFont("Rubik", bold ? "bold" : "normal");
  } catch {
    doc.setFont("helvetica", bold ? "bold" : "normal");
  }
  doc.setFontSize(size);
}

function setLatFont(doc: jsPDF, size: number, bold = false): void {
  try {
    doc.setFont("Rubik", bold ? "bold" : "normal");
  } catch {
    doc.setFont("helvetica", bold ? "bold" : "normal");
  }
  doc.setFontSize(size);
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

/** Profile / blank outline — dark gray (not green). */
const STROKE_RGB: [number, number, number] = [48, 48, 48];
/** Dimension lines, arrows, and numeric labels. */
const DIM_RGB: [number, number, number] = [82, 82, 82];

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
 * Rubik Latin glyphs: ascent ≈ 70 % of em → half-ascent ≈ 35 % × pt→mm.
 */
const HALF_ASCENT_FACTOR = 0.352778 * 0.35;

/** Dash pattern for dimension line (mm units). */
const DIM_LINE_DASH = [1.15, 0.95] as [number, number];

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
  label: string,
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

  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angleDeg > 90) angleDeg -= 180;
  if (angleDeg < -90) angleDeg += 180;

  const dimMidX = (ax + bx) / 2;
  const dimMidY = (ay + by) / 2;

  doc.setLineWidth(0.15);
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

  setLatFont(doc, fontSize);
  doc.setTextColor(DIM_RGB[0], DIM_RGB[1], DIM_RGB[2]);

  // jsPDF's align:"center" shifts x in PAGE coords, which is wrong for rotated
  // text (it shifts perpendicular to the run instead of along it).  We manually
  // center along the run direction and offset from the dim line in the normal
  // direction, with a baseline-to-visual-center correction for the rotation.
  const h = fontSize * HALF_ASCENT_FACTOR;
  const aRad = angleDeg * Math.PI / 180;
  const cosA = Math.cos(aRad);
  const sinA = Math.sin(aRad);

  // Text run direction in jsPDF coords: (cos α, −sin α)
  const tw = doc.getTextWidth(label);
  // Center along run: shift anchor by −tw/2 in run direction
  const runCenterX = -(tw / 2) * cosA;
  const runCenterY =  (tw / 2) * sinA;

  // Baseline-to-visual-center: "up from baseline" = (−sin α, −cos α) · h
  const baseX = h * sinA;
  const baseY = h * cosA;

  const labelX = dimMidX + nx * DIM_VISUAL_GAP_MM + baseX + runCenterX;
  const labelY = dimMidY + ny * DIM_VISUAL_GAP_MM + baseY + runCenterY;
  doc.text(label, labelX, labelY, {
    angle: angleDeg,
  });
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
  doc.setLineWidth(0.15);
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
  const gap = 2.5;
  const lx = cx + Math.cos(ma) * (radius + gap);
  const ly = cy + Math.sin(ma) * (radius + gap);
  setLatFont(doc, fontSize);
  doc.setTextColor(DIM_RGB[0], DIM_RGB[1], DIM_RGB[2]);
  // Manual centering: no rotation, so run dir = (1,0). Shift x by -tw/2, y by +h.
  const tw = doc.getTextWidth(label);
  const h = fontSize * HALF_ASCENT_FACTOR;
  doc.text(label, lx - tw / 2, ly + h);
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

  doc.setLineWidth(0.65);
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

  const arcR = Math.min(
    14,
    Math.max(6, Math.min(areaW, areaH) * 0.14)
  );
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
  panel: { l: number; t: number; r: number; b: number }
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

  doc.setLineWidth(0.45);
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

    doc.setLineWidth(0.22);
    doc.setDrawColor(210, 40, 40);
    const dashLen = 1.5;
    let curX = 0;
    const bendLabelFont = Math.min(dimFont, 9);

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

      const bendDeg = Math.round(bends[i]);
      const bendLabel = heb(`כיפוף ${bendDeg} מעלות`);
      setHebFont(doc, bendLabelFont);
      doc.setTextColor(210, 40, 40);
      // Manual centering (avoid align:"center" which shifts page-x, wrong for rotated text).
      // angle = -90: run direction = (cos −90, −sin −90) = (0, 1) = downward.
      const hBend = bendLabelFont * HALF_ASCENT_FACTOR;
      const btw = doc.getTextWidth(bendLabel);
      // Center along run (downward): shift y by −btw/2·(−sin(−90°)) = −btw/2
      doc.text(bendLabel, px + hBend, ry + rectH / 2 - btw / 2, {
        angle: -90,
      });
      doc.setTextColor(0);

      curX += ba;
    }
    doc.setDrawColor(0);
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

  doc.setLineWidth(0.5);
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
// Title block (ISO 7200 style, Hebrew RTL)
// ---------------------------------------------------------------------------

function drawTitleBlock(
  doc: jsPDF,
  partName: string,
  material: string,
  thicknessMm: number,
  plateWidthMm: number,
  weightKg: number,
  quantity: number,
  bendCount: number,
  finish: string
): void {
  doc.setLineWidth(0.5);
  doc.rect(TB_L, TB_T, TB_W, TB_H);
  doc.setLineWidth(0.2);

  const rh = TB_H / 5; // row height ~11.2

  // Horizontal rules
  for (let r = 1; r < 5; r++) {
    doc.line(TB_L, TB_T + rh * r, TB_L + TB_W, TB_T + rh * r);
  }
  // Vertical rules (varies per row)
  doc.line(TB_C1, TB_T, TB_C1, TB_T + rh);
  doc.line(TB_C2, TB_T, TB_C2, TB_T + rh);
  // row 1: full width (title)
  // row 2: 3 cols
  doc.line(TB_C1, TB_T + rh * 2, TB_C1, TB_T + rh * 3);
  doc.line(TB_C2, TB_T + rh * 2, TB_C2, TB_T + rh * 3);
  // row 3: 3 cols
  doc.line(TB_C1, TB_T + rh * 3, TB_C1, TB_T + rh * 4);
  doc.line(TB_C2, TB_T + rh * 3, TB_C2, TB_T + rh * 4);
  // row 4: 2 cols
  doc.line(TB_C1, TB_T + rh * 4, TB_C1, FB);

  const pad = 2;
  const labelSize = 5;
  const valueSize = 7;

  function cell(
    left: number,
    top: number,
    right: number,
    labelHe: string,
    value: string,
    valueIsHeb = false
  ) {
    const cy = top + rh / 2;
    // label (small, gray)
    setHebFont(doc, labelSize);
    doc.setTextColor(100);
    doc.text(heb(labelHe), right - pad, top + 3.5, { align: "right" });
    // value (larger, black)
    doc.setTextColor(0);
    if (valueIsHeb) {
      setHebFont(doc, valueSize);
      doc.text(heb(value), right - pad, cy + 2.5, { align: "right" });
    } else {
      setLatFont(doc, valueSize);
      doc.text(value, left + pad, cy + 2.5);
    }
  }

  // Row 0: Company / Sheet / Format
  cell(TB_L, TB_T, TB_C1, "חברה", "");
  cell(TB_C1, TB_T, TB_C2, "גיליון", "1 / 1");
  cell(TB_C2, TB_T, TB_L + TB_W, "פורמט", "A4");

  // Row 1: Title (part name) — full width
  {
    const top = TB_T + rh;
    setHebFont(doc, labelSize);
    doc.setTextColor(100);
    doc.text(heb("שם חלק"), TB_L + TB_W - pad, top + 3.5, { align: "right" });
    doc.setTextColor(0);
    setLatFont(doc, 9, true);
    doc.text(partName, TB_L + pad, top + rh / 2 + 2.5);
  }

  // Row 2: Drawing No / Material / Rev
  {
    const top = TB_T + rh * 2;
    cell(TB_L, top, TB_C1, "מספר שרטוט", partName);
    cell(TB_C1, top, TB_C2, "חומר", material);
    const bendLabel = bendCount > 0 ? `${bendCount}` : "-";
    cell(TB_C2, top, TB_L + TB_W, "כיפופים", bendLabel);
  }

  // Row 3: Thickness / Plate Width / Quantity
  {
    const top = TB_T + rh * 3;
    cell(TB_L, top, TB_C1, "עובי", `${thicknessMm} mm`);
    cell(TB_C1, top, TB_C2, "רוחב פלטה", `${plateWidthMm} mm`);
    cell(TB_C2, top, TB_L + TB_W, "כמות", `${quantity}`);
  }

  // Row 4: Weight / Finish
  {
    const top = TB_T + rh * 4;
    const wStr = weightKg > 0 ? `${Math.round(weightKg * 1000) / 1000} kg` : "-";
    cell(TB_L, top, TB_C1, "משקל", wStr);
    const finishDisplay = finish && finish !== "ללא" ? finish : "-";
    cell(TB_C1, top, TB_L + TB_W, "גימור", finishDisplay, true);
  }

  // Date + units small text in top-right corner
  setLatFont(doc, 4.5);
  doc.setTextColor(100);
  const today = new Date().toISOString().slice(0, 10);
  doc.text(today, TB_L + TB_W - pad, TB_T - 1.5, { align: "right" });
  doc.text("mm", TB_L + TB_W - pad - 22, TB_T - 1.5, { align: "right" });
  doc.setTextColor(0);
}

// ---------------------------------------------------------------------------
// Drawing border
// ---------------------------------------------------------------------------

function drawBorder(doc: jsPDF): void {
  doc.setLineWidth(0.7);
  doc.setDrawColor(0);
  doc.rect(FL, FT, FW, FH);
  doc.setLineWidth(0.15);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generatePlateDrawingPdf(
  part: QuotePartRow,
  bendItem: BendPlateQuoteItem | null,
  materialType: MaterialType
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
    drawViewHeaderStripe(doc);

    const pl = leftPanelBounds();
    const pr = rightPanelBounds();

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
      };

      const { pts, straights, bends } = buildForTemplate(
        formState.template,
        formState
      );
      const angles = internalAnglesFromPolyline(pts);

      const isFlat = bendItem.template === "plate";

      drawFlatBlankView(
        doc,
        bendItem.calc.blankLengthMm,
        bendItem.calc.blankWidthMm,
        straights,
        bends,
        bendItem.global.thicknessMm,
        materialType,
        pl
      );

      if (!isFlat && pts.length >= 3) {
        drawProfileView(doc, pts, straights, angles, pr);
      } else {
        drawFlatSideStripView(
          doc,
          Math.max(
            bendItem.calc.blankLengthMm,
            bendItem.calc.blankWidthMm
          ),
          bendItem.global.thicknessMm,
          pr
        );
      }

      const { grade, finish } = splitMaterialGradeAndFinish(
        bendItem.global.material
      );

      drawTitleBlock(
        doc,
        part.partName,
        grade,
        bendItem.global.thicknessMm,
        bendItem.global.plateWidthMm,
        bendItem.calc.weightKg,
        bendItem.global.quantity,
        bendItem.calc.bendCount,
        finish || bendItem.global.finish || ""
      );
    } else {
      const L = Math.max(1, part.lengthMm);
      const W = Math.max(1, part.widthMm);
      drawFlatBlankView(
        doc,
        L,
        W,
        [L, W, L, W],
        [],
        part.thicknessMm,
        materialType,
        pl
      );
      drawFlatSideStripView(doc, Math.max(L, W), part.thicknessMm, pr);

      const { grade, finish } = splitMaterialGradeAndFinish(part.material);
      drawTitleBlock(
        doc,
        part.partName,
        grade,
        part.thicknessMm,
        part.widthMm,
        part.weightKg,
        part.qty,
        0,
        finish
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
