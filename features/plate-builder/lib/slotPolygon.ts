const CAP_SEG = 10;

function dedupeRing(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-6) {
      out.push(p);
    }
  }
  if (out.length > 2) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) {
      out.pop();
    }
  }
  return out;
}

function circlePolyLocal(r: number, n: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI;
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  return pts;
}

/**
 * Stadium / slotted hole: constant width = diameter (semicircular ends), variable overall length.
 * Local +X = slot axis before rotation. CCW, Y-up.
 */
export function localCapsulePoints(overallLength: number, diameter: number): [number, number][] {
  const d = diameter;
  const r = d / 2;
  const L = overallLength;
  if (L <= d + 1e-9) {
    return dedupeRing(circlePolyLocal(r, 32));
  }
  const half = L / 2;
  const xL = -half + r;
  const xR = half - r;
  const seg = CAP_SEG;
  const pts: [number, number][] = [];
  pts.push([xL, -r]);
  pts.push([xR, -r]);
  for (let i = 1; i < seg; i++) {
    const t = -Math.PI / 2 + (i / seg) * Math.PI;
    pts.push([xR + r * Math.cos(t), r * Math.sin(t)]);
  }
  pts.push([xR, r]);
  pts.push([xL, r]);
  // Outer left semicircle: angles π/2 → 3π/2 (through π = leftmost point).
  // Do NOT use π/2 − Δπ (that traces the inner/right half of this circle → concave notch).
  for (let i = 1; i < seg; i++) {
    const t = Math.PI / 2 + (i / seg) * Math.PI;
    pts.push([xL + r * Math.cos(t), r * Math.sin(t)]);
  }
  pts.push([xL, -r]);
  return dedupeRing(pts);
}

/**
 * Slotted hole outline: width fixed to `diameter` (rounded ends), `overallLength` along slot axis.
 */
export function slottedHoleCapsuleOutline(
  cx: number,
  cy: number,
  overallLength: number,
  diameter: number,
  rotationDeg: number
): [number, number][] {
  const d = diameter;
  const L = Math.max(overallLength, d);
  const local = localCapsulePoints(L, d);
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return local.map(([lx, ly]) => [
    cx + lx * cos - ly * sin,
    cy + lx * sin + ly * cos,
  ]);
}

/** Corners of a slot (center, length along local X, width, rotation deg), CCW. */
export function slotCorners(
  cx: number,
  cy: number,
  length: number,
  width: number,
  rotationDeg: number
): [number, number][] {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hx = length / 2;
  const hy = width / 2;
  const local: [number, number][] = [
    [-hx, -hy],
    [hx, -hy],
    [hx, hy],
    [-hx, hy],
  ];
  return local.map(([lx, ly]) => [
    cx + lx * cos - ly * sin,
    cy + lx * sin + ly * cos,
  ]);
}
