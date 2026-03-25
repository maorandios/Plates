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
