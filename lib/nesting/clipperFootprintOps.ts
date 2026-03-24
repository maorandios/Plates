/**
 * Clipper helpers for polygon-aware nesting (mm ↔ scaled integers).
 */

import type { NestPoint } from "./convertGeometryToSvgNest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ClipperLib = require("clipper-lib") as {
  Clipper: {
    new (initOptions?: number): {
      AddPath: (
        path: Array<{ X: number; Y: number }>,
        polyType: number,
        closed: boolean
      ) => void;
      Execute: (
        clipType: number,
        solution: Array<Array<{ X: number; Y: number }>>,
        subjFillType: number,
        clipFillType: number
      ) => boolean;
      Area: (poly: Array<{ X: number; Y: number }>) => number;
    };
    Area: (poly: Array<{ X: number; Y: number }>) => number;
  };
  ClipperOffset: new (miterLimit: number, arcTolerance: number) => {
    AddPath: (path: Array<{ X: number; Y: number }>, joinType: number, endType: number) => void;
    Execute: (solution: Array<Array<{ X: number; Y: number }>>, delta: number) => void;
  };
  ClipType: { ctIntersection: number };
  PolyType: { ptSubject: number; ptClip: number };
  PolyFillType: { pftNonZero: number; pftPositive: number };
  JoinType: { jtMiter: number };
  EndType: { etClosedPolygon: number };
};

export const CLIPPER_SCALE_NEST = 1000;

export function nestPointsToClipperPath(ring: NestPoint[]): Array<{ X: number; Y: number }> {
  return ring.map((p) => ({
    X: Math.round(p.x * CLIPPER_SCALE_NEST),
    Y: Math.round(p.y * CLIPPER_SCALE_NEST),
  }));
}

export function clipperPathToNestPoints(path: Array<{ X: number; Y: number }>): NestPoint[] {
  return path.map((p) => ({
    x: p.X / CLIPPER_SCALE_NEST,
    y: p.Y / CLIPPER_SCALE_NEST,
  }));
}

export function clipperPathAreaMm2(path: Array<{ X: number; Y: number }>): number {
  return Math.abs(ClipperLib.Clipper.Area(path)) / (CLIPPER_SCALE_NEST * CLIPPER_SCALE_NEST);
}

export function pathsTotalAbsAreaMm2(paths: Array<Array<{ X: number; Y: number }>>): number {
  let s = 0;
  for (const p of paths) {
    s += clipperPathAreaMm2(p);
  }
  return s;
}

export function polygonAbsAreaMm2(ring: NestPoint[]): number {
  if (ring.length < 3) return 0;
  return clipperPathAreaMm2(nestPointsToClipperPath(ring));
}

export function offsetClosedPathOutwardMm(
  ring: NestPoint[],
  deltaMm: number
): NestPoint[] | null {
  if (ring.length < 3) return null;
  const path = nestPointsToClipperPath(ring);
  const delta = deltaMm * CLIPPER_SCALE_NEST;
  if (delta <= 0) return [...ring];

  try {
    const co = new ClipperLib.ClipperOffset(2, 0.25 * CLIPPER_SCALE_NEST);
    co.AddPath(path, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    const solution: Array<Array<{ X: number; Y: number }>> = [];
    co.Execute(solution, delta);
    if (!solution || solution.length === 0) return null;
    let best = solution[0]!;
    let bestArea = clipperPathAreaMm2(best);
    for (let i = 1; i < solution.length; i++) {
      const poly = solution[i]!;
      const a = clipperPathAreaMm2(poly);
      if (a > bestArea) {
        best = poly;
        bestArea = a;
      }
    }
    if (best.length < 3) return null;
    return clipperPathToNestPoints(best);
  } catch {
    return null;
  }
}

export function intersectionAreaMm2(a: NestPoint[], b: NestPoint[]): number {
  if (a.length < 3 || b.length < 3) return 0;
  try {
    const c = new ClipperLib.Clipper(0);
    c.AddPath(nestPointsToClipperPath(a), ClipperLib.PolyType.ptSubject, true);
    c.AddPath(nestPointsToClipperPath(b), ClipperLib.PolyType.ptClip, true);
    const sol: Array<Array<{ X: number; Y: number }>> = [];
    const ok = c.Execute(
      ClipperLib.ClipType.ctIntersection,
      sol,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero
    );
    if (!ok || sol.length === 0) return 0;
    return pathsTotalAbsAreaMm2(sol);
  } catch {
    return 0;
  }
}

/**
 * True when almost all of the subject area lies inside the clip (axis-aligned bin rectangle).
 */
export function isSubjectEssentiallyInsideClip(
  subject: NestPoint[],
  clip: NestPoint[],
  areaSlackMm2 = 0.5
): boolean {
  if (subject.length < 3 || clip.length < 3) return false;
  const subjArea = polygonAbsAreaMm2(subject);
  if (subjArea <= 0) return false;
  const interArea = intersectionAreaMm2(subject, clip);
  return interArea + areaSlackMm2 >= subjArea;
}
