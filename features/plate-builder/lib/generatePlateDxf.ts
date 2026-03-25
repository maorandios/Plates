import {
  DxfWriter,
  LWPolylineFlags,
  Units,
  point2d,
  point3d,
} from "@tarikjabiri/dxf";
import type { PlateBuilderSpecV1 } from "../types";
import { buildPlateGeometry } from "./buildPlateGeometry";

export function generatePlateDxf(spec: PlateBuilderSpecV1): string {
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Millimeters);
  dxf.addLayer("0", 7);
  dxf.setCurrentLayerName("0");

  const geo = buildPlateGeometry(spec);

  const outerVerts = geo.outer.map((p) => ({
    point: point2d(p[0], p[1]),
  }));
  dxf.addLWPolyline(outerVerts, { flags: LWPolylineFlags.Closed });

  for (const c of geo.holeCircles) {
    dxf.addCircle(point3d(c.cx, c.cy, 0), c.radius, {});
  }

  for (const ring of geo.slotOutlines) {
    const verts = ring.map((p) => ({ point: point2d(p[0], p[1]) }));
    dxf.addLWPolyline(verts, { flags: LWPolylineFlags.Closed });
  }

  return dxf.stringify();
}
