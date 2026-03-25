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
  diameter: number;
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

export interface BuiltPlateGeometry {
  /** Closed CCW outer ring in mm, Y-up, origin bottom-left */
  outer: [number, number][];
  /** Circular holes (for DXF CIRCLE entities) */
  holeCircles: Array<{ cx: number; cy: number; radius: number }>;
  /** Slot outlines (closed polylines) */
  slotOutlines: [number, number][][];
}
