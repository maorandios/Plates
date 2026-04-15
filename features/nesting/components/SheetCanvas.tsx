"use client";

import { useMemo } from "react";
import { Stage, Layer, Line, Rect, Group, Text } from "react-konva";
import type { GeneratedSheet, SheetPlacement } from "@/types";
import { transformPoint, transformContour } from "@/lib/geometry/viewTransform";
import type { Point } from "@/lib/geometry/extract";
import { sheetViewTransform } from "@/lib/nesting/sheetCanvasTransform";
import {
  offsetContourToSheetSpace,
  polygonCentroidMm,
} from "@/lib/nesting/nestingResultsUtils";

function toScreen(
  mm: Point,
  t: ReturnType<typeof sheetViewTransform>,
  pan: { x: number; y: number }
): [number, number] {
  const [sx, sy] = transformPoint(mm, t);
  return [sx + pan.x, sy + pan.y];
}

interface SheetCanvasProps {
  sheet: GeneratedSheet;
  selectedInstanceId: string | null;
  onSelectPart: (p: SheetPlacement | null) => void;
  width: number;
  height: number;
  zoom: number;
  pan: { x: number; y: number };
}

export function SheetCanvas({
  sheet,
  selectedInstanceId,
  onSelectPart,
  width,
  height,
  zoom,
  pan,
}: SheetCanvasProps) {
  const transform = useMemo(
    () => sheetViewTransform(sheet, width, height, 40, zoom),
    [sheet, width, height, zoom]
  );

  const sheetFlat = useMemo(() => {
    const rect: Point[] = [
      [0, 0],
      [sheet.widthMm, 0],
      [sheet.widthMm, sheet.lengthMm],
      [0, sheet.lengthMm],
    ];
    const pts = transformContour(rect, transform);
    const out: number[] = [];
    for (const [x, y] of pts) {
      out.push(x + pan.x, y + pan.y);
    }
    return out;
  }, [sheet, transform, pan]);

  const innerOutline = useMemo(() => {
    const { ox, oy } = {
      ox: (sheet.widthMm - sheet.innerWidthMm) / 2,
      oy: (sheet.lengthMm - sheet.innerLengthMm) / 2,
    };
    const rect: Point[] = [
      [ox, oy],
      [ox + sheet.innerWidthMm, oy],
      [ox + sheet.innerWidthMm, oy + sheet.innerLengthMm],
      [ox, oy + sheet.innerLengthMm],
    ];
    const pts = transformContour(rect, transform);
    const out: number[] = [];
    for (const [x, y] of pts) {
      out.push(x + pan.x, y + pan.y);
    }
    return out;
  }, [sheet, transform, pan]);

  const fontSize = useMemo(
    () => Math.min(22, Math.max(9, transform.scale * sheet.widthMm * 0.018)),
    [transform.scale, sheet.widthMm]
  );

  return (
    <div className="rounded-lg overflow-hidden bg-slate-50 shadow-inner">
      <Stage width={width} height={height}>
        <Layer>
          <Rect
            width={width}
            height={height}
            fill="#f1f5f9"
            listening
            onMouseDown={() => onSelectPart(null)}
            onTap={() => onSelectPart(null)}
          />
          <Line
            points={sheetFlat}
            closed
            fill="#ffffff"
            stroke="#64748b"
            strokeWidth={2}
            lineJoin="round"
            listening={false}
          />
          <Line
            points={innerOutline}
            closed
            stroke="#94a3b8"
            strokeWidth={1}
            dash={[6, 4]}
            listening={false}
          />
        </Layer>
        <Layer>
          {sheet.placements.map((pl) => {
            const outer = offsetContourToSheetSpace(pl.outerContour, sheet);
            const outerPts = transformContour(outer as Point[], transform).flatMap(
              ([x, y]) => [x + pan.x, y + pan.y]
            );
            const selected = pl.partInstanceId === selectedInstanceId;
            const holes = pl.innerContours.map((hole) => {
              const h = offsetContourToSheetSpace(hole, sheet);
              return transformContour(h as Point[], transform).flatMap(([x, y]) => [
                x + pan.x,
                y + pan.y,
              ]);
            });
            const [cx, cy] = polygonCentroidMm(outer);
            const [tx, ty] = toScreen([cx, cy] as Point, transform, pan);

            return (
              <Group
                key={pl.partInstanceId}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  onSelectPart(pl);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  onSelectPart(pl);
                }}
              >
                <Line
                  points={outerPts}
                  closed
                  fill={selected ? "rgba(106,35,247,0.22)" : "rgba(106,35,247,0.12)"}
                  stroke={selected ? "#15803d" : "#16a34a"}
                  strokeWidth={selected ? 3 : 2}
                  lineJoin="round"
                />
                {holes.map((flat, hi) => (
                  <Line
                    key={`${pl.partInstanceId}-h-${hi}`}
                    points={flat}
                    closed
                    fill="#ffffff"
                    stroke="#2563eb"
                    strokeWidth={1.5}
                    lineJoin="round"
                    listening={false}
                  />
                ))}
                {pl.markingText ? (
                  <Text
                    x={tx}
                    y={ty}
                    text={pl.markingText}
                    fontSize={fontSize}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fontStyle="bold"
                    fill="#6b21a8"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={Math.max(0.5, fontSize * 0.06)}
                    align="center"
                    verticalAlign="middle"
                    width={Math.min(280, sheet.widthMm * transform.scale * 0.5)}
                    wrap="word"
                    offsetX={Math.min(280, sheet.widthMm * transform.scale * 0.5) / 2}
                    offsetY={fontSize * 0.55}
                    listening={false}
                  />
                ) : null}
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
