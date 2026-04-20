"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Stage, Layer, Line, Text, Group, Circle, Rect } from "react-konva";
import type { CleanedGeometryResult, ProcessedGeometry } from "@/types";
import type { UnitSystem } from "@/types/settings";
import type { Point } from "@/lib/geometry/extract";
import {
  calculateViewTransform,
  transformContour,
  transformPoint,
} from "@/lib/geometry/viewTransform";
import { openPolygonVertices } from "@/lib/geometry/dimensions";
import { formatLength } from "@/lib/settings/unitSystem";
import { boundingBoxUnionOfContours } from "@/lib/geometry/calc";
import {
  getMarkingFontSizePx,
  getMarkingPositionMm,
} from "@/lib/geometry/marking";
import { cn } from "@/lib/utils";

/** Max distance (px) from pointer to vertex to snap */
const SNAP_PX = 16;

interface SnapPoint {
  mm: Point;
  screen: [number, number];
}

function asPointRing(ring: [number, number][]): Point[] {
  return ring.map(([x, y]) => [x, y] as Point);
}

function collectSnapPoints(
  geometry: ProcessedGeometry,
  transform: ReturnType<typeof calculateViewTransform>,
  debugMode: boolean,
  debugCleaned: CleanedGeometryResult | null | undefined
): SnapPoint[] {
  const vertices: Point[] = [];
  vertices.push(...openPolygonVertices(geometry.outer));
  for (const hole of geometry.holes) {
    vertices.push(...openPolygonVertices(hole));
  }
  if (debugMode && debugCleaned) {
    const addRing = (r: [number, number][]) => {
      vertices.push(...openPolygonVertices(r as unknown as Point[]));
    };
    for (const r of debugCleaned.reconstructedClosedLoops ?? []) addRing(r);
    for (const r of debugCleaned.classificationDiscarded ?? []) addRing(r);
    for (const r of debugCleaned.removedFragments ?? []) addRing(r);
    for (const r of debugCleaned.invalidFragments ?? []) addRing(r);
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

function allRingsForBounds(
  geometry: ProcessedGeometry,
  debugCleaned: CleanedGeometryResult | null | undefined,
  markingPaths: [number, number][][]
): Point[][] {
  const rings: Point[][] = [];
  if (geometry.outer.length) rings.push(geometry.outer as Point[]);
  for (const h of geometry.holes) rings.push(h as Point[]);
  if (debugCleaned) {
    for (const r of debugCleaned.reconstructedClosedLoops ?? []) {
      if (r.length) rings.push(asPointRing(r));
    }
    for (const r of debugCleaned.removedFragments ?? []) {
      if (r.length) rings.push(asPointRing(r));
    }
    for (const r of debugCleaned.invalidFragments ?? []) {
      if (r.length) rings.push(asPointRing(r));
    }
    for (const r of debugCleaned.classificationDiscarded ?? []) {
      if (r.length) rings.push(asPointRing(r));
    }
    if (debugCleaned.outerContour.length) {
      rings.push(asPointRing(debugCleaned.outerContour));
    }
    for (const h of debugCleaned.innerContours) {
      if (h.length) rings.push(asPointRing(h));
    }
  }
  for (const p of markingPaths) {
    if (p.length) rings.push(asPointRing(p));
  }
  return rings.filter((r) => r.length > 0);
}

interface PlateGeometryCanvasProps {
  geometry: ProcessedGeometry;
  width?: number;
  height?: number;
  measureMode?: boolean;
  clearMeasurementKey?: number;
  unitSystem?: UnitSystem;
  /** Overlay pipeline layers (green/blue/red/orange etc.) */
  debugMode?: boolean;
  debugCleaned?: CleanedGeometryResult | null;
  /** From manufacturing.marking.paths when non-empty (debug polylines, not label text) */
  markingDebugPaths?: [number, number][][];
  /** Plate marking preview: part name ± client code; empty hides the MARKING text layer */
  plateMarkingText?: string;
  /**
   * DXF review modal: brand purple stroke, light lavender plate fill (#F4EEFF), transparent canvas.
   * Hides the bottom W×H overlay (dimensions shown in the modal panel instead).
   */
  appearance?: "default" | "previewModal";
}

export function PlateGeometryCanvas({
  geometry,
  width = 600,
  height = 500,
  measureMode = false,
  clearMeasurementKey = 0,
  unitSystem = "metric",
  debugMode = false,
  debugCleaned = null,
  markingDebugPaths = [],
  plateMarkingText = "",
  appearance = "default",
}: PlateGeometryCanvasProps) {
  const markingPaths = markingDebugPaths ?? [];
  const markingLabel = plateMarkingText.trim();
  const previewModal = appearance === "previewModal" && !debugMode;

  const geomBounds = useMemo(() => {
    if (debugMode && debugCleaned) {
      const rings = allRingsForBounds(geometry, debugCleaned, markingPaths);
      if (rings.length > 0) return boundingBoxUnionOfContours(rings);
    }
    return geometry.boundingBox;
  }, [debugMode, debugCleaned, geometry, markingPaths]);

  /** Modal preview: keep padding within canvas so fit never uses negative available width on narrow hosts. */
  const viewPadding = useMemo(() => {
    if (!previewModal) return 50;
    const m = Math.min(width, height);
    const maxPad = Math.floor((m - 1) / 2);
    return Math.min(50, Math.max(0, maxPad));
  }, [previewModal, width, height]);

  const transform = useMemo(() => {
    return calculateViewTransform(geomBounds, width, height, viewPadding);
  }, [geomBounds, width, height, viewPadding]);

  const outerPoints = useMemo(() => {
    if (geometry.outer.length === 0) return [];
    const pts = transformContour(geometry.outer, transform);
    if (pts.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y)))
      return [];
    return pts;
  }, [geometry.outer, transform]);

  const holePointsArray = useMemo(() => {
    return geometry.holes
      .map((hole) => transformContour(hole, transform))
      .filter((pts) =>
        pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
      );
  }, [geometry.holes, transform]);

  const debugLayers = useMemo(() => {
    if (!debugMode || !debugCleaned) return null;
    return {
      preClosed: (debugCleaned.reconstructedClosedLoops ?? []).map((r) =>
        transformContour(r as unknown as Point[], transform)
      ),
      outsideOuter: (debugCleaned.classificationDiscarded ?? []).map((r) =>
        transformContour(r as unknown as Point[], transform)
      ),
      removed: (debugCleaned.removedFragments ?? []).map((r) =>
        transformContour(r as unknown as Point[], transform)
      ),
      invalid: (debugCleaned.invalidFragments ?? []).map((r) =>
        transformContour(r as unknown as Point[], transform)
      ),
      markingDxfPaths: markingPaths.map((r) =>
        transformContour(r as unknown as Point[], transform)
      ),
    };
  }, [debugMode, debugCleaned, transform, markingPaths]);

  const snapPoints = useMemo(
    () => collectSnapPoints(geometry, transform, debugMode, debugCleaned),
    [geometry.outer, geometry.holes, transform, debugMode, debugCleaned]
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

  const measurementLabel = useMemo(() => {
    if (measurementMm == null) return "";
    return formatLength(measurementMm, unitSystem);
  }, [measurementMm, unitSystem]);

  const bboxLabelW = useMemo(
    () => formatLength(geomBounds.width, unitSystem),
    [geomBounds.width, unitSystem]
  );
  const bboxLabelH = useMemo(
    () => formatLength(geomBounds.height, unitSystem),
    [geomBounds.height, unitSystem]
  );

  const p1Screen = p1Mm ? (transformPoint(p1Mm, transform) as [number, number]) : null;
  const p2Screen = p2Mm ? (transformPoint(p2Mm, transform) as [number, number]) : null;

  const markingLayout = useMemo(() => {
    if (!markingLabel || geometry.outer.length === 0) return null;
    const pos = getMarkingPositionMm(geometry.outer as Point[]);
    if (!pos) return null;
    const [sx, sy] = transformPoint([pos.x, pos.y], transform);
    const fontSize = getMarkingFontSizePx(pos.width, transform.scale);
    const plateScreenW = pos.width * transform.scale;
    const textWidth = Math.min(width * 0.9, Math.max(96, plateScreenW * 0.9));
    const textHeight = Math.max(fontSize * 1.4, 24);
    return { sx, sy, fontSize, textWidth, textHeight };
  }, [markingLabel, geometry.outer, transform, width]);

  const hasNormalOuter = geometry.outer.length > 0;
  const hasDebugDraw =
    debugMode &&
    debugLayers &&
    (debugLayers.preClosed.some((pts) => pts.length >= 3) ||
      debugLayers.outsideOuter.some((pts) => pts.length >= 3) ||
      debugLayers.removed.some((pts) => pts.length >= 3) ||
      debugLayers.invalid.some((pts) => pts.length >= 2) ||
      debugLayers.markingDxfPaths.some((pts) => pts.length >= 2));

  if (!hasNormalOuter && !hasDebugDraw) {
    return (
      <div
        className="flex items-center justify-center bg-muted/20 rounded-lg border border-border"
        style={{ width, height }}
      >
        <p className="text-sm text-muted-foreground">No geometry to display</p>
      </div>
    );
  }

  const holeStroke = previewModal
    ? "#6A23F7"
    : debugMode
      ? "#2563eb"
      : "#dc2626";
  const holeFill = previewModal
    ? "rgba(0,0,0,0)"
    : debugMode
      ? "rgba(37,99,235,0.12)"
      : "#ffffff";
  const outerStroke = previewModal
    ? "#6A23F7"
    : debugMode
      ? "#6A23F7"
      : "#1e40af";
  const outerFill = previewModal
    ? "#F4EEFF"
    : debugMode
      ? "rgba(106,35,247,0.15)"
      : "#e0f2fe";

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden",
        previewModal ? "bg-transparent" : "bg-white"
      )}
      style={{ cursor: measureMode ? "crosshair" : "default" }}
    >
      <Stage
        width={width}
        height={height}
        style={previewModal ? { background: "transparent" } : undefined}
      >
        <Layer listening={false}>
          {debugMode && debugLayers && (
            <>
              {debugLayers.preClosed.map((pts, i) => {
                const flat = pts.flat();
                if (flat.length < 4) return null;
                return (
                  <Line
                    key={`pre-${i}`}
                    points={flat}
                    closed
                    fill="rgba(100,116,139,0.08)"
                    stroke="#64748b"
                    strokeWidth={1.5}
                    dash={[5, 4]}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              })}
              {debugLayers.outsideOuter.map((pts, i) => {
                const flat = pts.flat();
                if (flat.length < 4) return null;
                return (
                  <Line
                    key={`out-${i}`}
                    points={flat}
                    closed
                    fill="rgba(192,38,211,0.06)"
                    stroke="#a21caf"
                    strokeWidth={2}
                    dash={[6, 3]}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              })}
              {debugLayers.removed.map((pts, i) => {
                const flat = pts.flat();
                if (flat.length < 4) return null;
                return (
                  <Line
                    key={`rm-${i}`}
                    points={flat}
                    closed
                    stroke="#dc2626"
                    strokeWidth={2}
                    dash={[8, 4]}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              })}
              {debugLayers.invalid.map((pts, i) => {
                const flat = pts.flat();
                if (flat.length < 4) return null;
                return (
                  <Line
                    key={`inv-${i}`}
                    points={flat}
                    closed={false}
                    stroke="#ea580c"
                    strokeWidth={2}
                    dash={[4, 3]}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              })}
              {debugLayers.markingDxfPaths.map((pts, i) => {
                const flat = pts.flat();
                if (flat.length < 4) return null;
                return (
                  <Line
                    key={`mk-path-${i}`}
                    points={flat}
                    closed={false}
                    stroke="#9333ea"
                    strokeWidth={2}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              })}
            </>
          )}

          {hasNormalOuter && (
            <Line
              points={outerPoints.flat()}
              closed
              fill={outerFill}
              stroke={outerStroke}
              strokeWidth={debugMode ? 2.5 : 2}
              lineCap="round"
              lineJoin="round"
            />
          )}

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
                fill={holeFill}
                stroke={holeStroke}
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
              />
            );
          })}
        </Layer>

        {markingLayout && (
          <Layer listening={false}>
            <Group
              x={markingLayout.sx}
              y={markingLayout.sy}
              listening={false}
            >
              {debugMode && (
                <>
                  <Rect
                    x={-markingLayout.textWidth / 2 - 6}
                    y={-markingLayout.textHeight / 2 - 4}
                    width={markingLayout.textWidth + 12}
                    height={markingLayout.textHeight + 8}
                    stroke="#9333ea"
                    strokeWidth={1}
                    dash={[5, 4]}
                    fill="rgba(147,51,234,0.06)"
                    listening={false}
                  />
                  <Text
                    x={0}
                    y={-markingLayout.textHeight / 2 - 22}
                    text="MARKING"
                    fontSize={11}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fill="#7c3aed"
                    fontStyle="bold"
                    align="center"
                    width={markingLayout.textWidth}
                    offsetX={markingLayout.textWidth / 2}
                    listening={false}
                  />
                </>
              )}
              <Text
                x={0}
                y={0}
                text={markingLabel}
                fontSize={markingLayout.fontSize}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontStyle="bold"
                fill="#581c87"
                stroke="rgba(255,255,255,0.92)"
                strokeWidth={Math.max(1, markingLayout.fontSize * 0.06)}
                lineJoin="round"
                align="center"
                verticalAlign="middle"
                width={markingLayout.textWidth}
                height={markingLayout.textHeight}
                offsetX={markingLayout.textWidth / 2}
                offsetY={markingLayout.textHeight / 2}
                wrap="word"
                listening={false}
              />
            </Group>
          </Layer>
        )}

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

          {measureMode && p1Screen && p2Screen && measurementLabel && (
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
                  text={measurementLabel}
                  fontSize={12}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fill="#0f172a"
                  align="center"
                  verticalAlign="middle"
                  width={Math.max(88, measurementLabel.length * 7)}
                  height={18}
                  offsetX={Math.max(88, measurementLabel.length * 7) / 2}
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

      {!previewModal && (
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono bg-white/90 backdrop-blur-sm rounded px-2 py-1 border border-border">
          <span>W: {bboxLabelW}</span>
          <span>×</span>
          <span>H: {bboxLabelH}</span>
          {geometry.holes.length > 0 && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className={debugMode ? "text-blue-600" : "text-red-600"}>
                {geometry.holes.length} hole{geometry.holes.length > 1 ? "s" : ""}
              </span>
            </>
          )}
          {debugMode && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-violet-700">Debug</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
