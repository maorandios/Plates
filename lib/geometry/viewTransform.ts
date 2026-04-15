/**
 * View transform utilities for rendering geometry in a canvas.
 * Handles coordinate system conversion (DXF y-up → screen y-down),
 * fit-to-view scaling, and centering.
 */

import type { Point } from "./extract";
import type { BoundingBox } from "./calc";

export interface ViewTransform {
  /** Scale factor (DXF units → screen pixels) */
  scale: number;
  /** Translation offset for centering (screen pixels) */
  offsetX: number;
  offsetY: number;
  /** Bounding box of the geometry in DXF coordinates */
  geomBounds: BoundingBox;
}

/**
 * Calculate a view transform that fits the geometry inside the canvas
 * with padding, preserving aspect ratio.
 *
 * @param geomBounds - Bounding box of the geometry in DXF coordinates (mm)
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param padding - Padding in pixels (default: 40)
 */
export function calculateViewTransform(
  geomBounds: BoundingBox,
  canvasWidth: number,
  canvasHeight: number,
  padding = 40
): ViewTransform {
  const { width: gw, height: gh, minX, minY } = geomBounds;

  if (
    gw <= 0 ||
    gh <= 0 ||
    !Number.isFinite(gw) ||
    !Number.isFinite(gh) ||
    !Number.isFinite(minX) ||
    !Number.isFinite(minY)
  ) {
    return {
      scale: 1,
      offsetX: canvasWidth / 2,
      offsetY: canvasHeight / 2,
      geomBounds,
    };
  }

  const availableWidth = Math.max(1, canvasWidth - 2 * padding);
  const availableHeight = Math.max(1, canvasHeight - 2 * padding);

  const scaleX = availableWidth / gw;
  const scaleY = availableHeight / gh;
  const rawScale = Math.min(scaleX, scaleY);
  const scale = Math.min(rawScale, 1e6);

  // Center of geometry in DXF coordinates
  const geomCenterX = minX + gw / 2;
  const geomCenterY = minY + gh / 2;

  // Canvas center
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;

  // Offset calculation accounting for Y-flip:
  // Screen X = dxfX * scale + offsetX
  // Screen Y = -dxfY * scale + offsetY
  // We want: screenCenter = transformedGeomCenter
  const offsetX = canvasCenterX - geomCenterX * scale;
  const offsetY = canvasCenterY + geomCenterY * scale; // + because of the Y-flip

  return { scale, offsetX, offsetY, geomBounds };
}

/**
 * Transform a single point from DXF coordinates to screen coordinates.
 * Applies scale, Y-flip (DXF is y-up, screen is y-down), and translation.
 */
export function transformPoint(
  point: Point,
  transform: ViewTransform
): [number, number] {
  const { scale, offsetX, offsetY } = transform;
  const [x, y] = point;
  return [x * scale + offsetX, -y * scale + offsetY];
}

/**
 * Transform an entire contour from DXF coordinates to screen coordinates.
 */
export function transformContour(
  contour: Point[],
  transform: ViewTransform
): [number, number][] {
  return contour.map((pt) => transformPoint(pt, transform));
}
