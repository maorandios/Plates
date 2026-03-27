/** Human-readable labels for nesting engine ids stored on runs. */

export type NestingEngineId = "heuristic" | "svgnest";

export function formatNestingEngineTitle(
  engine: NestingEngineId | undefined
): string {
  if (engine === "svgnest") {
    return "SVGnest-style (NFP + GA)";
  }
  return "Heuristic (anchors + compaction)";
}

export function formatNestingEngineShort(
  engine: NestingEngineId | undefined
): string {
  if (engine === "svgnest") {
    return "NFP + GA";
  }
  return "Heuristic";
}

/** One-line explanation for the results summary / tooltips. */
export function formatNestingEngineDescription(
  engine: NestingEngineId | undefined
): string {
  if (engine === "svgnest") {
    return "Clipper Minkowski NFP, genetic algorithm on part order and rotations, greedy placement (SVGnest-style).";
  }
  return "Multi-pass ordering, anchor/score candidates, compaction — optimized for speed.";
}
