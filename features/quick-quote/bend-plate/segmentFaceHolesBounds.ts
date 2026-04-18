import { localCapsulePoints } from "@/features/plate-builder/lib/slotPolygon";
import type { BendSegmentHole, BendSegmentHoleKind } from "./types";

/** Oval: overall length along slot (mm), ≥ diameter. */
export function resolvedOvalLengthMm(h: BendSegmentHole): number {
  const d = Math.max(0, h.diameterMm);
  const L = h.ovalLengthMm ?? h.ovalOverallMm ?? d;
  return Math.max(L, d);
}

/**
 * Stadium outline in segment (u,v) mm: +u = plate width, +v = segment length (down on preview).
 * `rotationDeg` is clockwise from +u. Geometry matches plate-builder capsule (straight sides + semicircular ends).
 */
export function capsuleOutlineUvMm(
  centerU: number,
  centerV: number,
  h: BendSegmentHole
): [number, number][] {
  const d = Math.max(0, h.diameterMm);
  const L = resolvedOvalLengthMm(h);
  const rot = h.rotationDeg ?? 0;
  const localYUp = localCapsulePoints(L, d);
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return localYUp.map(([lx, ly]) => {
    const du0 = lx;
    const dv0 = -ly;
    const du = du0 * cos + dv0 * sin;
    const dv = -du0 * sin + dv0 * cos;
    return [centerU + du, centerV + dv] as [number, number];
  });
}

/** Width used for hole placement when user width is 0 (matches preview placeholder). */
export function segmentFaceEffectiveWidthMm(
  plateWidthMm: number,
  segmentLenMm: number,
  plateWidthDrawMm: number
): number {
  const rawW = Math.max(0, plateWidthMm);
  if (rawW > 1e-6) return rawW;
  return Math.max(plateWidthDrawMm, 1e-6);
}

/** True if the hole’s axis-aligned footprint fits inside the segment face (width × length). */
export function holeFitsOnSegmentFace(
  h: BendSegmentHole,
  widthMm: number,
  segmentLenMm: number
): boolean {
  const W = Math.max(widthMm, 1e-6);
  const L = Math.max(segmentLenMm, 1e-6);
  const { hu, hv } = holeHalfExtentsMm(h);
  return 2 * hu <= W + 1e-4 && 2 * hv <= L + 1e-4;
}

export function holeHalfExtentsMm(h: BendSegmentHole): { hu: number; hv: number } {
  const d = Math.max(0, h.diameterMm);
  switch (h.kind) {
    case "round":
      return { hu: d / 2, hv: d / 2 };
    case "oval": {
      const slotLen = resolvedOvalLengthMm(h);
      const θ = ((h.rotationDeg ?? 0) * Math.PI) / 180;
      const hu =
        (slotLen / 2) * Math.abs(Math.cos(θ)) + (d / 2) * Math.abs(Math.sin(θ));
      const hv =
        (slotLen / 2) * Math.abs(Math.sin(θ)) + (d / 2) * Math.abs(Math.cos(θ));
      return { hu, hv };
    }
    case "rect": {
      const rw = Math.max(0, h.rectWidthMm ?? 0);
      const rl = Math.max(0, h.rectLengthMm ?? 0);
      const θ = ((h.rotationDeg ?? 0) * Math.PI) / 180;
      const hu =
        (rw / 2) * Math.abs(Math.cos(θ)) + (rl / 2) * Math.abs(Math.sin(θ));
      const hv =
        (rw / 2) * Math.abs(Math.sin(θ)) + (rl / 2) * Math.abs(Math.cos(θ));
      return { hu, hv };
    }
    default:
      return { hu: 0, hv: 0 };
  }
}

export function clampHoleCenterUv(
  u: number,
  v: number,
  h: BendSegmentHole,
  widthMm: number,
  segmentLenMm: number
): [number, number] {
  const W = Math.max(widthMm, 1e-6);
  const L = Math.max(segmentLenMm, 1e-6);
  const { hu, hv } = holeHalfExtentsMm(h);
  if (W < 2 * hu || L < 2 * hv) {
    return [W / 2, L / 2];
  }
  return [
    Math.min(Math.max(u, hu), W - hu),
    Math.min(Math.max(v, hv), L - hv),
  ];
}

/**
 * Clamp hole center to the face, then snap to whole millimeters (1 mm grid).
 */
export function clampAndSnapHoleCenterTo1Mm(
  u: number,
  v: number,
  h: BendSegmentHole,
  widthMm: number,
  segmentLenMm: number
): [number, number] {
  let [uc, vc] = clampHoleCenterUv(u, v, h, widthMm, segmentLenMm);
  uc = Math.round(uc);
  vc = Math.round(vc);
  [uc, vc] = clampHoleCenterUv(uc, vc, h, widthMm, segmentLenMm);
  return [Math.round(uc), Math.round(vc)];
}

/** When switching hole kind in the editor, preserve center and pick sensible defaults. */
export function bendHoleWithNewKind(
  h: BendSegmentHole,
  kind: BendSegmentHoleKind
): BendSegmentHole {
  const { id, uMm, vMm } = h;
  if (kind === "round") {
    const d = Math.max(0, h.diameterMm > 0 ? h.diameterMm : 10);
    return { id, kind: "round", uMm, vMm, diameterMm: d };
  }
  if (kind === "oval") {
    const d = Math.max(0, h.diameterMm > 0 ? h.diameterMm : 10);
    const ovalLen = Math.max(
      resolvedOvalLengthMm({ ...h, kind: "oval", diameterMm: d }),
      d
    );
    return {
      id,
      kind: "oval",
      uMm,
      vMm,
      diameterMm: d,
      ovalLengthMm: ovalLen,
      rotationDeg: h.rotationDeg ?? 0,
    };
  }
  return {
    id,
    kind: "rect",
    uMm,
    vMm,
    diameterMm: 0,
    rectLengthMm: Math.max(0, h.rectLengthMm ?? 20),
    rectWidthMm: Math.max(0, h.rectWidthMm ?? 15),
    rotationDeg: h.rotationDeg ?? 0,
  };
}
