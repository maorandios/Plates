import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { t } from "@/lib/i18n";

const ED = "quote.bendPlatePhase.editor";

function fmtMm(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? formatInteger(Math.round(r)) : formatDecimal(r, 1);
}

type Pt = { x: number; y: number };

export type SegmentFaceSvgModel =
  | { kind: "empty"; vb: string; vbW: number; vbH: number }
  | {
      kind: "ok";
      vb: string;
      vbW: number;
      vbH: number;
      rect: { x: number; y: number; w: number; h: number };
      widthPlaceholder: boolean;
      segmentLenMm: number;
      /** User-entered plate width (may be 0). */
      plateWidthMm: number;
      /** Width used when drawing the rectangle if plate width is tiny / zero. */
      plateWidthDrawMm: number;
      extenders: { x1: number; y1: number; x2: number; y2: number }[];
      dimLines: { x1: number; y1: number; x2: number; y2: number }[];
      labels: { x: number; y: number; text: string; angle: number }[];
      corners: Pt[];
    };

/**
 * ViewBox + plate rectangle for segment face preview (shared by SVG + Konva overlay).
 */
export function computeSegmentFaceSvgModel(
  lengthMm: number,
  widthMm: number,
  segmentLabel: string
): SegmentFaceSvgModel {
  const L = Math.max(0, lengthMm);
  const rawW = Math.max(0, widthMm);

  if (L < 1e-6) {
    return { kind: "empty", vb: "0 0 120 80", vbW: 120, vbH: 80 };
  }

  const placeholderPlateW = Math.max(L * 0.42, 18);
  let plateWDraw: number;
  if (rawW <= 1e-6) {
    plateWDraw = placeholderPlateW;
  } else if (rawW < L * 0.06) {
    plateWDraw = L * 0.06;
  } else {
    plateWDraw = rawW;
  }

  const segLen = L;
  const rectW = plateWDraw;
  const rectH = segLen;
  const span0 = Math.max(rectW, rectH, 1);
  const offset = Math.max(span0 * 0.09, 5);
  const textGap = Math.max(span0 * 0.055, 3.5);

  const rx0 = 0;
  const ry0 = 0;
  const pTL: Pt = { x: rx0, y: ry0 };
  const pTR: Pt = { x: rx0 + rectW, y: ry0 };
  const pBL: Pt = { x: rx0, y: ry0 + rectH };
  const pBR: Pt = { x: rx0 + rectW, y: ry0 + rectH };

  const cx = (pTL.x + pTR.x + pBL.x + pBR.x) / 4;
  const cy = (pTL.y + pTR.y + pBL.y + pBR.y) / 4;

  const extenders: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const dimLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const labels: { x: number; y: number; text: string; angle: number }[] = [];

  {
    const p0 = pBL;
    const p1 = pBR;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      const ux = dx / len;
      const uy = dy / len;
      let nx = -uy;
      let ny = ux;
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      if (nx * (midX - cx) + ny * (midY - cy) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const p0o = { x: p0.x + nx * offset, y: p0.y + ny * offset };
      const p1o = { x: p1.x + nx * offset, y: p1.y + ny * offset };
      extenders.push(
        { x1: p0.x, y1: p0.y, x2: p0o.x, y2: p0o.y },
        { x1: p1.x, y1: p1.y, x2: p1o.x, y2: p1o.y }
      );
      dimLines.push({ x1: p0o.x, y1: p0o.y, x2: p1o.x, y2: p1o.y });
      const text = t(`${ED}.holesFaceDimWidth`, { mm: fmtMm(rawW) });
      const tx = midX + nx * (offset + textGap);
      const ty = midY + ny * (offset + textGap);
      let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angleDeg > 90) angleDeg -= 180;
      if (angleDeg < -90) angleDeg += 180;
      labels.push({ x: tx, y: ty, text, angle: angleDeg });
    }
  }

  {
    const p0 = pTL;
    const p1 = pBL;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      const ux = dx / len;
      const uy = dy / len;
      let nx = -uy;
      let ny = ux;
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      if (nx * (midX - cx) + ny * (midY - cy) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const p0o = { x: p0.x + nx * offset, y: p0.y + ny * offset };
      const p1o = { x: p1.x + nx * offset, y: p1.y + ny * offset };
      extenders.push(
        { x1: p0.x, y1: p0.y, x2: p0o.x, y2: p0o.y },
        { x1: p1.x, y1: p1.y, x2: p1o.x, y2: p1o.y }
      );
      dimLines.push({ x1: p0o.x, y1: p0o.y, x2: p1o.x, y2: p1o.y });
      const text = t(`${ED}.holesFaceDimLen`, {
        label: segmentLabel,
        mm: fmtMm(L),
      });
      const tx = midX + nx * (offset + textGap);
      const ty = midY + ny * (offset + textGap);
      let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angleDeg > 90) angleDeg -= 180;
      if (angleDeg < -90) angleDeg += 180;
      labels.push({ x: tx, y: ty, text, angle: angleDeg });
    }
  }

  const labelBoxUnit = Math.max(span0 * 0.04, 6);
  const segLabelBox = 1.25 * 1.25;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const expand = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const p of [pTL, pTR, pBL, pBR]) expand(p.x, p.y);
  for (const e of extenders) {
    expand(e.x1, e.y1);
    expand(e.x2, e.y2);
  }
  for (const d of dimLines) {
    expand(d.x1, d.y1);
    expand(d.x2, d.y2);
  }
  for (const lb of labels) {
    const hw = lb.text.length * labelBoxUnit * 0.32 * segLabelBox;
    const hh = labelBoxUnit * 0.72 * segLabelBox;
    expand(lb.x - hw, lb.y - hh);
    expand(lb.x + hw, lb.y + hh);
  }

  const pad = Math.max(span0 * 0.04, 2);
  const rcx = rx0 + rectW / 2;
  const rcy = ry0 + rectH / 2;
  const halfW = Math.max(rcx - minX, maxX - rcx, 1e-6);
  const halfH = Math.max(rcy - minY, maxY - rcy, 1e-6);
  const vbW = 2 * halfW + 2 * pad;
  const vbH = 2 * halfH + 2 * pad;
  const shiftX = vbW / 2 - rcx;
  const shiftY = vbH / 2 - rcy;

  const sh = (p: Pt) => ({ x: p.x + shiftX, y: p.y + shiftY });

  const corners = [pTL, pTR, pBR, pBL].map(sh);

  return {
    kind: "ok",
    vb: `0 0 ${vbW.toFixed(2)} ${vbH.toFixed(2)}`,
    vbW,
    vbH,
    rect: {
      x: rx0 + shiftX,
      y: ry0 + shiftY,
      w: rectW,
      h: rectH,
    },
    widthPlaceholder: rawW <= 1e-6,
    segmentLenMm: segLen,
    plateWidthMm: rawW,
    plateWidthDrawMm: plateWDraw,
    extenders: extenders.map((e) => ({
      x1: e.x1 + shiftX,
      y1: e.y1 + shiftY,
      x2: e.x2 + shiftX,
      y2: e.y2 + shiftY,
    })),
    dimLines: dimLines.map((e) => ({
      x1: e.x1 + shiftX,
      y1: e.y1 + shiftY,
      x2: e.x2 + shiftX,
      y2: e.y2 + shiftY,
    })),
    labels: labels.map((lb) => ({
      x: lb.x + shiftX,
      y: lb.y + shiftY,
      text: lb.text,
      angle: lb.angle,
    })),
    corners,
  };
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Match ProfilePreview2D / SegmentFacePreview2D annotation stroke scaling. */
export function segmentFaceAnnotationStylesForView(
  viewPxW: number,
  viewPxH: number,
  vbW: number,
  vbH: number
) {
  const vw = Math.max(viewPxW, 1);
  const vh = Math.max(viewPxH, 1);
  const bw = Math.max(vbW, 1);
  const bh = Math.max(vbH, 1);
  const scale = Math.min(vw / bw, vh / bh);
  const geomLongPx = Math.max(bw, bh) * scale;

  const labelPx = clamp(geomLongPx * 0.0225, 10.5, 12.75);
  const labelFontUser = labelPx / scale;
  const segmentLabelFontUser = labelFontUser * 1.25 * 1.25;

  const dimStrokePx = clamp(geomLongPx * 0.002, 0.72, 1.12);
  const extStrokePx = dimStrokePx * 0.92;
  const dashLenPx = clamp(geomLongPx * 0.011, 3.2, 5.8);
  const dashGapPx = clamp(geomLongPx * 0.0085, 2.4, 4.5);

  return {
    meetScale: scale,
    segmentLabelFontUser,
    dimStrokePx,
    extStrokePx,
    dashArray: `${dashLenPx}px ${dashGapPx}px`,
  };
}
