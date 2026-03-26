import {
  DxfWriter,
  LWPolylineFlags,
  Units,
  point2d,
  point3d,
} from "@tarikjabiri/dxf";
import type { PlateBuilderSpecV1 } from "../types";
import { buildPlateGeometry } from "./buildPlateGeometry";
import { findMarkingPlacement } from "./markingPlacement";

/** CNC marking / scribe — configure your post to process this layer separately from cut (layer 0). */
export const PLATE_DXF_MARKING_LAYER = "MARKING";

/** ACI color 3 (green): visually distinct from cut geometry on layer 0 (color 7). */
const MARKING_LAYER_COLOR = 3;

const MARKING_MARGIN_MM = 2.5;

function sanitizeDxfText(s: string): string {
  return s
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/%/g, "%%")
    .slice(0, 250);
}

export function generatePlateDxf(spec: PlateBuilderSpecV1): string {
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Millimeters);
  dxf.addLayer("0", 7);
  dxf.addLayer(PLATE_DXF_MARKING_LAYER, MARKING_LAYER_COLOR);
  dxf.setCurrentLayerName("0");

  const geo = buildPlateGeometry(spec);

  const outerVerts = geo.outer.map((p) => ({
    point: point2d(p[0], p[1]),
  }));
  dxf.addLWPolyline(outerVerts, { flags: LWPolylineFlags.Closed });

  for (const hi of geo.holeItems) {
    if (hi.kind === "circle") {
      dxf.addCircle(point3d(hi.cx, hi.cy, 0), hi.radius, {});
    } else if (hi.kind === "slotted") {
      const verts = hi.outline.map((p) => ({ point: point2d(p[0], p[1]) }));
      dxf.addLWPolyline(verts, { flags: LWPolylineFlags.Closed });
    }
  }

  for (const ring of geo.slotOutlines) {
    const verts = ring.map((p) => ({ point: point2d(p[0], p[1]) }));
    dxf.addLWPolyline(verts, { flags: LWPolylineFlags.Closed });
  }

  const partLine = sanitizeDxfText(spec.partName);
  const matLine = sanitizeDxfText(spec.material);
  if (partLine || matLine) {
    const plateMin = Math.min(spec.width, spec.height);
    const textH = Math.min(6, Math.max(2.5, plateMin * 0.035));
    const lineGap = textH * 1.35;
    const placed = findMarkingPlacement(
      geo,
      partLine,
      matLine,
      textH,
      lineGap,
      plateMin,
      MARKING_MARGIN_MM
    );
    if (placed) {
      const { x, yBase } = placed;
      const markingOpts = { layerName: PLATE_DXF_MARKING_LAYER } as const;
      if (matLine) {
        dxf.addText(point3d(x, yBase, 0), textH, matLine, markingOpts);
      }
      if (partLine) {
        dxf.addText(
          point3d(x, yBase + (matLine ? lineGap : 0), 0),
          textH,
          partLine,
          markingOpts
        );
      }
    }
  }

  return dxf.stringify();
}
