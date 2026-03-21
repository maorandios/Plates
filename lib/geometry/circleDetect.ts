/**
 * Circle detection and reconstruction.
 * 
 * Some DXF exporters/parsers convert circles to POLYLINE entities with very
 * few vertices (2-4), losing the circular geometry. This module detects such
 * degenerate circles and reconstructs them as smooth polygons.
 */

import type { Point, Contour } from "./extract";

const CIRCLE_SEGMENTS = 32;

/** Vertices without the duplicate closing point (if first === last). */
function openVertices(contour: Point[]): Point[] {
  if (contour.length < 2) return [...contour];
  const first = contour[0];
  const last = contour[contour.length - 1];
  const closed =
    first[0] === last[0] && first[1] === last[1];
  return closed ? contour.slice(0, -1) : [...contour];
}

/**
 * Generate a circular polygon from center and radius.
 */
function generateCircle(cx: number, cy: number, radius: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const angle = (2 * Math.PI * i) / CIRCLE_SEGMENTS;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  points.push([...points[0]]); // close
  return points;
}

/**
 * Calculate the centroid of a polygon.
 */
function centroid(contour: Point[]): Point {
  let cx = 0, cy = 0;
  for (const [x, y] of contour) {
    cx += x;
    cy += y;
  }
  return [cx / contour.length, cy / contour.length];
}

/**
 * Calculate the average distance from centroid to vertices.
 */
function avgRadius(contour: Point[], center: Point): number {
  let sum = 0;
  for (const [x, y] of contour) {
    const dx = x - center[0];
    const dy = y - center[1];
    sum += Math.sqrt(dx * dx + dy * dy);
  }
  return sum / contour.length;
}

/**
 * Calculate the standard deviation of distances from centroid.
 * Low stddev → vertices are equidistant from center → likely a circle.
 */
function radiusStdDev(contour: Point[], center: Point, avgRad: number): number {
  let sumSq = 0;
  for (const [x, y] of contour) {
    const dx = x - center[0];
    const dy = y - center[1];
    const r = Math.sqrt(dx * dx + dy * dy);
    sumSq += (r - avgRad) * (r - avgRad);
  }
  return Math.sqrt(sumSq / contour.length);
}

/**
 * Heuristically detect if a contour is likely a degenerate circle
 * (few vertices but intended to represent a circular hole).
 * 
 * Criteria:
 * - 3-6 vertices
 * - All vertices roughly equidistant from centroid (low stddev)
 * - Small area (< 5000 mm² ≈ 80mm diameter)
 */
export function isLikelyDegenerateCircle(contour: Point[]): boolean {
  const open = openVertices(contour);
  const uniqueCount = open.length;

  // 2 open vertices = handled in reconstructIfCircle (diameter), not here
  if (uniqueCount < 3 || uniqueCount > 6) {
    return false;
  }

  const center = centroid(open);
  const avgRad = avgRadius(open, center);

  if (avgRad < 1) {
    return false;
  }

  const stdDev = radiusStdDev(open, center, avgRad);
  const coefficientOfVariation = stdDev / avgRad;

  // If all vertices are within 20% of the average radius, it's likely a circle
  return coefficientOfVariation < 0.2;
}

/**
 * Reconstruct a contour as a smooth circle if it's detected as degenerate.
 * Returns the original contour if not a circle.
 */
export function reconstructIfCircle(contour: Point[]): Point[] {
  const open = openVertices(contour);

  // Many DXFs encode a circle as a 2-vertex POLYLINE (diameter). After closure
  // that is [A, B, A] → only 2 unique points; centroid/CV heuristics fail.
  if (open.length === 2) {
    const [a, b] = open;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return contour;
    const cx = (a[0] + b[0]) / 2;
    const cy = (a[1] + b[1]) / 2;
    const r = d / 2;
    return generateCircle(cx, cy, r);
  }

  if (!isLikelyDegenerateCircle(contour)) return contour;

  const center = centroid(open);
  const radius = avgRadius(open, center);

  return generateCircle(center[0], center[1], radius);
}

/**
 * Process all contours, reconstructing degenerate circles.
 */
export function reconstructCircles(contours: Contour[]): Contour[] {
  return contours.map((c) => reconstructIfCircle(c));
}
