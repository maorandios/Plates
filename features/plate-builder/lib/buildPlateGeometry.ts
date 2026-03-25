import type { BuiltPlateGeometry, PlateBuilderSpecV1 } from "../types";
import { outerContourForShape } from "./outerContours";
import { slotCorners } from "./slotPolygon";

export function buildPlateGeometry(spec: PlateBuilderSpecV1): BuiltPlateGeometry {
  const { width: w, height: h } = spec;
  const outer = outerContourForShape(
    spec.shapeType,
    w,
    h,
    spec.cornerRadius,
    spec.chamferSize
  );

  const holeCircles = spec.holes.map((hole) => ({
    cx: hole.cx,
    cy: hole.cy,
    radius: hole.diameter / 2,
  }));

  const slotOutlines = spec.slots.map((s) =>
    slotCorners(s.cx, s.cy, s.length, s.width, s.rotationDeg)
  );

  return { outer, holeCircles, slotOutlines };
}
