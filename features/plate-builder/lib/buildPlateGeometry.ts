import type { BuiltPlateGeometry, PlateBuilderSpecV1 } from "../types";
import { holeIsSlotted } from "../types";
import { outerContourForShape } from "./outerContours";
import { slotCorners, slottedHoleCapsuleOutline } from "./slotPolygon";

export function buildPlateGeometry(spec: PlateBuilderSpecV1): BuiltPlateGeometry {
  const { width: w, height: h } = spec;
  const outer = outerContourForShape(
    spec.shapeType,
    w,
    h,
    spec.cornerRadius,
    spec.chamferSize
  );

  const holeItems = spec.holes.map((hole) => {
    if (holeIsSlotted(hole)) {
      const L = hole.length ?? 0;
      const d = hole.diameter;
      const rot = hole.rotationDeg ?? 0;
      const Leff = Math.max(L, d);
      return {
        kind: "slotted" as const,
        cx: hole.cx,
        cy: hole.cy,
        outline: slottedHoleCapsuleOutline(hole.cx, hole.cy, Leff, d, rot),
      };
    }
    return {
      kind: "circle" as const,
      cx: hole.cx,
      cy: hole.cy,
      radius: hole.diameter / 2,
    };
  });

  const slotOutlines = spec.slots.map((s) =>
    slotCorners(s.cx, s.cy, s.length, s.width, s.rotationDeg)
  );

  return { outer, holeItems, slotOutlines };
}
