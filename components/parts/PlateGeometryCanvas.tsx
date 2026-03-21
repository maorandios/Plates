"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Stage, Layer, Line, Text, Group, Circle, Rect } from "react-konva";
import type { ProcessedGeometry } from "@/types";
import type { Point } from "@/lib/geometry/extract";
import { calculateViewTransform, transformContour, transformPoint } from "@/lib/geometry/viewTransform";
import { openPolygonVertices } from "@/lib/geometry/dimensions";

/** Max distance (px) from pointer to vertex to snap */
const SNAP_PX = 16;

interface SnapPoint {
  mm: Point;
  screen: [number, number];
}

function collectSnapPoints(geometry: ProcessedGeometry, transform: ReturnType<typeof calculateViewTransform>): SnapPoint[] {
  const vertices: Point[] = [];
  vertices.push(...openPolygonVertices(geometry.outer));
  for (const hole of geometry.holes) {
    vertices.push(...openPolygonVertices(hole));
  }
  return vertices.map((mm) => ({
    mm,
    screen: transformPoint(mm, transform) as [number, number],
  }));
}

function findNearestSnap(
  screenX: number,
  screenY: number,
  snaps: SnapPoint[],
  maxDist: number
): SnapPoint | null {
  let best: SnapPoint | null = null;
  let bestD = Infinity;
  for (const s of snaps) {
    const dx = s.screen[0] - screenX;
    const dy = s.screen[1] - screenY;
    const d = Math.hypot(dx, dy);
    if (d < bestD && d <= maxDist) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

interface PlateGeometryCanvasProps {
  geometry: ProcessedGeometry;
  width?: number;
  height?: number;
  /** When true, user can click two vertices (snapped) to measure distance */
  measureMode?: boolean;
  /** Increment to clear the current measurement from parent */
  clearMeasurementKey?: number;
}

export function PlateGeometryCanvas({
  geometry,
  width = 600,
  height = 500,
  measureMode = false,
  clearMeasurementKey = 0,
}: PlateGeometryCanvasProps) {
  const transform = useMemo(() => {
    return calculateViewTransform(geometry.boundingBox, width, height, 50);
  }, [geometry.boundingBox, width, height]);

  const outerPoints = useMemo(() => {
    if (geometry.outer.length === 0) return [];
    return transformContour(geometry.outer, transform);
  }, [geometry.outer, transform]);

  const holePointsArray = useMemo(() => {
    return geometry.holes.map((hole) => transformContour(hole, transform));
  }, [geometry.holes, transform]);

  const snapPoints = useMemo(
    () => collectSnapPoints(geometry, transform),
    [geometry.outer, geometry.holes, transform]
  );

  const [measurePts, setMeasurePts] = useState<{ p1: Point | null; p2: Point | null }>({
    p1: null,
    p2: null,
  });
  const [hoverSnap, setHoverSnap] = useState<SnapPoint | null>(null);

  const resetMeasurement = useCallback(() => {
    setMeasurePts({ p1: null, p2: null });
  }, []);

  useEffect(() => {
    if (!measureMode) {
      resetMeasurement();
    }
  }, [measureMode, resetMeasurement]);

  useEffect(() => {
    resetMeasurement();
  }, [clearMeasurementKey, resetMeasurement]);

  const handlePointerMove = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!measureMode) {
        setHoverSnap(null);
        return;
      }
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      setHoverSnap(findNearestSnap(pos.x, pos.y, snapPoints, SNAP_PX));
    },
    [measureMode, snapPoints]
  );

  const handlePointerClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!measureMode) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const snap = findNearestSnap(pos.x, pos.y, snapPoints, SNAP_PX);
      if (!snap) return;

      setMeasurePts((m) => {
        if (m.p1 == null) return { p1: snap.mm, p2: null };
        if (m.p2 == null) return { p1: m.p1, p2: snap.mm };
        // Full measurement done — start a new one from this vertex
        return { p1: snap.mm, p2: null };
      });
    },
    [measureMode, snapPoints]
  );

  useEffect(() => {
    if (!measureMode) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        resetMeasurement();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [measureMode, resetMeasurement]);

  const p1Mm = measurePts.p1;
  const p2Mm = measurePts.p2;

  const measurementMm = useMemo(() => {
    if (!p1Mm || !p2Mm) return null;
    return Math.hypot(p2Mm[0] - p1Mm[0], p2Mm[1] - p1Mm[1]);
  }, [p1Mm, p2Mm]);

  const p1Screen = p1Mm ? (transformPoint(p1Mm, transform) as [number, number]) : null;
  const p2Screen = p2Mm ? (transformPoint(p2Mm, transform) as [number, number]) : null;

  if (geometry.outer.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-muted/20 rounded-lg border border-border"
        style={{ width, height }}
      >
        <p className="text-sm text-muted-foreground">No geometry to display</p>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-lg border border-border overflow-hidden bg-white"
      style={{ cursor: measureMode ? "crosshair" : "default" }}
    >
      <Stage width={width} height={height}>
        <Layer listening={false}>
          <Line
            points={outerPoints.flat()}
            closed
            fill="#e0f2fe"
            stroke="#1e40af"
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
          />

          {holePointsArray.map((hole, i) => {
            const flatPoints = hole.flat();
            if (flatPoints.length < 6) {
              return null;
            }
            return (
              <Line
                key={`hole-${i}`}
                points={flatPoints}
                closed
                fill="#ffffff"
                stroke="#dc2626"
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
              />
            );
          })}
        </Layer>

        {/* Manual measurement overlay — draw first; transparent hit-rect last (on top) */}
        <Layer listening={measureMode}>
          {measureMode && hoverSnap && (
            <Circle
              x={hoverSnap.screen[0]}
              y={hoverSnap.screen[1]}
              radius={7}
              stroke="#2563eb"
              strokeWidth={2}
              fill="rgba(37,99,235,0.15)"
              listening={false}
            />
          )}

          {measureMode && p1Screen && (
            <Circle
              x={p1Screen[0]}
              y={p1Screen[1]}
              radius={5}
              fill="#1e40af"
              stroke="#ffffff"
              strokeWidth={2}
              listening={false}
            />
          )}
          {measureMode && p2Screen && (
            <Circle
              x={p2Screen[0]}
              y={p2Screen[1]}
              radius={5}
              fill="#1d4ed8"
              stroke="#ffffff"
              strokeWidth={2}
              listening={false}
            />
          )}

          {measureMode && p1Screen && p2Screen && measurementMm != null && (
            <Group listening={false}>
              <Line
                points={[p1Screen[0], p1Screen[1], p2Screen[0], p2Screen[1]]}
                stroke="#2563eb"
                strokeWidth={2}
                lineCap="round"
                dash={[6, 4]}
              />
              <Group
                x={(p1Screen[0] + p2Screen[0]) / 2}
                y={(p1Screen[1] + p2Screen[1]) / 2}
              >
                <Text
                  x={0}
                  y={0}
                  text={`${measurementMm.toFixed(2)} mm`}
                  fontSize={12}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fill="#0f172a"
                  align="center"
                  verticalAlign="middle"
                  width={Math.max(88, `${measurementMm.toFixed(2)} mm`.length * 7)}
                  height={18}
                  offsetX={Math.max(88, `${measurementMm.toFixed(2)} mm`.length * 7) / 2}
                  offsetY={9}
                  listening={false}
                />
              </Group>
            </Group>
          )}

          {measureMode && (
            <Rect
              width={width}
              height={height}
              fill="transparent"
              onMouseMove={handlePointerMove}
              onTouchMove={handlePointerMove}
              onClick={handlePointerClick}
            />
          )}
        </Layer>
      </Stage>

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-4 text-xs text-muted-foreground font-mono bg-white/90 backdrop-blur-sm rounded px-2 py-1 border border-border">
        <span>W: {geometry.boundingBox.width.toFixed(1)} mm</span>
        <span>×</span>
        <span>H: {geometry.boundingBox.height.toFixed(1)} mm</span>
        {geometry.holes.length > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-red-600">
              {geometry.holes.length} hole{geometry.holes.length > 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
