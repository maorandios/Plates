/**
 * Pre-CAM geometry preparation: cleanup, contour reconstruction/classification,
 * and manufacturing-oriented groupings (no toolpaths or G-code).
 */

/** UI / pipeline rollup — maps from legacy GeometryStatus where needed */
export type GeometryCleanupStatus = "ready" | "warning" | "error";

export interface DiscardedSketchEntity {
  /** Machine-readable category, e.g. "stray_fragment", "open_chain" */
  reason: string;
  detail: string;
}

export interface CleanedGeometryResult {
  /** Classified outer boundary in mm */
  outerContour: [number, number][];
  /** Classified holes / inner cutouts in mm */
  innerContours: [number, number][][];
  /**
   * Closed loops removed before classification as non-geometric noise (degenerate only).
   * Small holes are no longer removed here — they go to classification first.
   */
  removedFragments: [number, number][][];
  /** Open / unclosed chains that could not be snapped closed */
  invalidFragments: [number, number][][];
  /** Closed loops outside the classified outer (not treated as holes) */
  classificationDiscarded: [number, number][][];
  /** All closed loops after reconstruction, before outer/hole split (debug) */
  reconstructedClosedLoops: [number, number][][];
  /** Segments or loops removed or left unusable during cleanup / reconstruction */
  discardedEntities: DiscardedSketchEntity[];
  /** Non-fatal issues (repairs, heuristics, unsupported fragments) */
  warnings: string[];
  /** Fatal issues for this preparation pass */
  errors: string[];
  cleanupStatus: GeometryCleanupStatus;
  stats?: {
    rawContourCount: number;
    normalizedContourCount: number;
    closedLoopCount: number;
    innerClassifiedCount: number;
    removedFragmentCount: number;
    invalidFragmentCount: number;
    classificationDiscardedCount: number;
  };
}

/** Marking paths reserved for future plate marking (client code / part ID text) */
export interface MarkingLayerGeometry {
  paths: [number, number][][];
  note?: string;
}

/**
 * Export-oriented grouping. Vertices duplicate {@link ProcessedGeometry} outer/holes
 * at runtime; persisted copies may omit paths (see store slimming).
 */
export interface ManufacturingGeometry {
  cutOuter: [number, number][];
  cutInner: [number, number][][];
  marking: MarkingLayerGeometry;
  /** {@link DxfPartGeometry.id} when known */
  sourceGeometryId: string;
}

export interface GeometryPreparation {
  cleaned: CleanedGeometryResult;
  manufacturing: ManufacturingGeometry;
}

/** Summarised status for parts table / previews */
export interface PartGeometryPrepStatus {
  isValid: boolean;
  cleanupStatus: GeometryCleanupStatus;
  messages: string[];
}
