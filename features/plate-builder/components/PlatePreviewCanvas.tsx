"use client";

import { Stage, Layer, Line, Circle } from "react-konva";
import { buildPlateGeometry } from "../lib/buildPlateGeometry";
import type { PlateBuilderSpecV1 } from "../types";

const CW = 480;
const CH = 360;
const PAD = 28;

export function PlatePreviewCanvas({ spec }: { spec: PlateBuilderSpecV1 }) {
  const bw = spec.width;
  const bh = spec.height;
  if (
    !Number.isFinite(bw) ||
    !Number.isFinite(bh) ||
    bw <= 0 ||
    bh <= 0
  ) {
    return (
      <div className="flex h-[360px] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Enter width and height to preview
      </div>
    );
  }

  let geo;
  try {
    geo = buildPlateGeometry(spec);
  } catch {
    return (
      <div className="flex h-[360px] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Invalid plate parameters
      </div>
    );
  }

  const scale = Math.min((CW - 2 * PAD) / bw, (CH - 2 * PAD) / bh);
  const ox = (CW - bw * scale) / 2;
  const oy = (CH - bh * scale) / 2;
  const tx = (x: number) => ox + x * scale;
  const ty = (y: number) => oy + (bh - y) * scale;

  const outerPts = geo.outer.flatMap(([x, y]) => [tx(x), ty(y)]);

  return (
    <div className="rounded-xl border border-border bg-[#fafafa] overflow-hidden">
      <Stage width={CW} height={CH}>
        <Layer>
          <Line
            points={outerPts}
            closed
            stroke="#1d4ed8"
            strokeWidth={2}
            lineJoin="round"
          />
          {geo.holeCircles.map((h, i) => (
            <Circle
              key={`h-${i}`}
              x={tx(h.cx)}
              y={ty(h.cy)}
              radius={Math.max(0.5, h.radius * scale)}
              stroke="#dc2626"
              strokeWidth={1.5}
            />
          ))}
          {geo.slotOutlines.map((ring, i) => (
            <Line
              key={`s-${i}`}
              points={ring.flatMap(([x, y]) => [tx(x), ty(y)])}
              closed
              stroke="#ea580c"
              strokeWidth={1.5}
              lineJoin="miter"
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
