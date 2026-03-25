/** MVP shapes implemented in geometry + DXF; triangle/trapezoid reserved for later. */
export type PlateBuilderShapeMvp =
  | "rectangle"
  | "rectangleRounded"
  | "rectangleChamfered";

export type PlateBuilderShapeType =
  | PlateBuilderShapeMvp
  | "triangle"
  | "trapezoid";

export interface PlateBuilderHole {
  id: string;
  cx: number;
  cy: number;
  /** Round hole, and the fixed width of a slotted hole (semicircular ends use d/2). */
  diameter: number;
  /** Slotted hole: overall length along slot axis (≥ diameter); width is always `diameter`. */
  length?: number;
  rotationDeg?: number;
}

/** Slotted (rounded-end capsule); width is always `diameter`. */
export function holeIsSlotted(hole: PlateBuilderHole): boolean {
  return (hole.length ?? 0) > 0;
}

export interface PlateBuilderSlot {
  id: string;
  cx: number;
  cy: number;
  length: number;
  width: number;
  rotationDeg: number;
}

/** Persisted with built DXF uploads for reopen/edit later. */
export interface PlateBuilderSpecV1 {
  version: 1;
  shapeType: PlateBuilderShapeMvp;
  width: number;
  height: number;
  /** Used when shapeType === rectangleRounded */
  cornerRadius: number;
  /** Used when shapeType === rectangleChamfered */
  chamferSize: number;
  holes: PlateBuilderHole[];
  slots: PlateBuilderSlot[];
  partName: string;
  quantity: number;
  material: string;
  thickness: number;
  clientId: string;
}

export type BuiltHoleGeom =
  | { kind: "circle"; cx: number; cy: number; radius: number }
  | {
      kind: "slotted";
      cx: number;
      cy: number;
      outline: [number, number][];
    };

export interface BuiltPlateGeometry {
  /** Closed CCW outer ring in mm, Y-up, origin bottom-left */
  outer: [number, number][];
  /** One entry per `spec.holes` (circle or slotted capsule) */
  holeItems: BuiltHoleGeom[];
  /** Slot outlines (closed polylines) */
  slotOutlines: [number, number][][];
}
