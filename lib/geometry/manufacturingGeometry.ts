/**
 * Stage E — Manufacturing layer preparation: CUT_OUTER, CUT_INNER, MARKING (placeholder).
 * No toolpaths, kerf, or machine output — only grouped polylines for a future exporter.
 */

import type { ManufacturingGeometry } from "@/types";
import type { Point } from "./extract";

const MARKING_NOTE =
  "Reserved for plate marking (part name / client code). Not generated in this phase.";

function toTupleRing(loop: Point[]): [number, number][] {
  return loop.map(([x, y]) => [x, y] as [number, number]);
}

export function buildManufacturingGeometry(args: {
  sourceGeometryId: string;
  outer: Point[];
  holes: Point[][];
}): ManufacturingGeometry {
  return {
    sourceGeometryId: args.sourceGeometryId,
    cutOuter: toTupleRing(args.outer),
    cutInner: args.holes.map((h) => toTupleRing(h)),
    marking: {
      paths: [],
      note: MARKING_NOTE,
    },
  };
}

export function emptyManufacturingGeometry(
  sourceGeometryId: string
): ManufacturingGeometry {
  return {
    sourceGeometryId,
    cutOuter: [],
    cutInner: [],
    marking: { paths: [], note: MARKING_NOTE },
  };
}
