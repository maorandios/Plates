import type { GeneratedSheet } from "@/types";
import type { ViewTransform } from "@/lib/geometry/viewTransform";
import type { BoundingBox } from "@/lib/geometry/calc";

export function sheetViewTransform(
  sheet: GeneratedSheet,
  canvasWidth: number,
  canvasHeight: number,
  padding: number,
  zoom: number
): ViewTransform {
  const gw = sheet.widthMm;
  const gh = sheet.lengthMm;
  const geomBounds: BoundingBox = {
    minX: 0,
    minY: 0,
    maxX: gw,
    maxY: gh,
    width: gw,
    height: gh,
  };
  if (gw <= 0 || gh <= 0) {
    return {
      scale: 1,
      offsetX: canvasWidth / 2,
      offsetY: canvasHeight / 2,
      geomBounds,
    };
  }
  const avW = canvasWidth - 2 * padding;
  const avH = canvasHeight - 2 * padding;
  const fit = Math.min(avW / gw, avH / gh);
  const scale = fit * zoom;
  const geomCenterX = gw / 2;
  const geomCenterY = gh / 2;
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;
  const offsetX = canvasCenterX - geomCenterX * scale;
  const offsetY = canvasCenterY + geomCenterY * scale;
  return { scale, offsetX, offsetY, geomBounds };
}
