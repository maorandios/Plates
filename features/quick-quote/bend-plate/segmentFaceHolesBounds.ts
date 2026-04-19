import { localCapsulePoints } from "@/features/plate-builder/lib/slotPolygon";
import type { BendSegmentHole, BendSegmentHoleKind } from "./types";

/** Oval: overall length along slot (mm), ≥ diameter. */
export function resolvedOvalLengthMm(h: BendSegmentHole): number {
  const d = Math.max(0, h.diameterMm);
  const L = h.ovalLengthMm ?? h.ovalOverallMm ?? d;
  return Math.max(L, d);
}

/**
 * Unit direction (du, dv) of the oval slot’s long axis in face coordinates:
 * +u = plate width, +v = along the segment (same as {@link capsuleOutlineUvMm}).
 * Unrotated slot axis is along +u → (du0,dv0)=(1,0); Konva’s clockwise rotation by `rotationDeg`
 * (its standard rotation matrix, identical to the one used on rect in Konva) gives
 * (du,dv) = (cos θ, sin θ). At θ = 90° the slot rotates onto +v (along the segment).
 *
 * Choosing +u as the default lets users create a slot longer than the segment’s run without first
 * setting rotation = 90° — on typical sheet-metal work the plate-width direction is the longer one.
 */
export function ovalSlotLongAxisUnitUv(rotationDeg: number): { du: number; dv: number } {
  const rad = ((rotationDeg ?? 0) * Math.PI) / 180;
  return { du: Math.cos(rad), dv: Math.sin(rad) };
}

/**
 * Stadium outline in segment (u,v) mm: +u = plate width, +v = segment length (down on preview).
 * `rotationDeg` is clockwise from +u (plate width): 0° = slot runs across the plate width,
 * 90° = along the segment. Rotation matrix matches Konva `Rect`’s rotation so oval and rect share
 * a single sign convention everywhere (2D overlay, DXF blank, 3D preview, validator).
 */
export function capsuleOutlineUvMm(
  centerU: number,
  centerV: number,
  h: BendSegmentHole
): [number, number][] {
  const d = Math.max(0, h.diameterMm);
  const L = resolvedOvalLengthMm(h);
  const rot = h.rotationDeg ?? 0;
  const local = localCapsulePoints(L, d);
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  /** `localCapsulePoints` uses +X along the slot long axis — map that directly to +u. */
  return local.map(([lx, ly]) => {
    const du = lx * cos - ly * sin;
    const dv = lx * sin + ly * cos;
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
      /** Slot long axis = +u at θ=0, short axis (= diameter) along +v. */
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
      /** rectLength along +u at θ=0, rectWidth along +v. */
      const θ = ((h.rotationDeg ?? 0) * Math.PI) / 180;
      const hu =
        (rl / 2) * Math.abs(Math.cos(θ)) + (rw / 2) * Math.abs(Math.sin(θ));
      const hv =
        (rl / 2) * Math.abs(Math.sin(θ)) + (rw / 2) * Math.abs(Math.cos(θ));
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
