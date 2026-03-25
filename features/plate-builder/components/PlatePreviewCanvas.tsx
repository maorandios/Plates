"use client";

import { Fragment, useEffect, useRef, useState, useMemo } from "react";
import { Stage, Layer, Line, Circle, Group, Text } from "react-konva";
import { buildPlateGeometry } from "../lib/buildPlateGeometry";
import { slotCorners } from "../lib/slotPolygon";
import type {
  PlateBuilderHole,
  PlateBuilderSlot,
  PlateBuilderSpecV1,
} from "../types";
import { holeIsSlotted } from "../types";
import { previewMarginMm } from "../lib/plateViewConstants";
import {
  clampCapsuleHoleCenterToFit,
  clampHoleCenter,
  clampSlotCenterToFit,
  conservativeCenterBounds,
} from "../lib/bounds";

const PAD_PX = 24;
const OUTLINE_STROKE_PX = 2;
const FEATURE_STROKE_PX = 1.5;
const DIM_STROKE = "#94a3b8";
const HIT_WIDE = 22;

/** Slots snap to 1 mm (integer positions). */
function snapSlotPositionMm(cx: number, cy: number): [number, number] {
  return [Math.round(cx), Math.round(cy)];
}

/** Holes snap to a 5 mm grid (positions only). */
function snapHolePositionMm(cx: number, cy: number): [number, number] {
  return [Math.round(cx / 5) * 5, Math.round(cy / 5) * 5];
}

function finalizeHolePosition(
  sx: number,
  sy: number,
  cw: number,
  ch: number,
  bw: number,
  bh: number,
  scale: number,
  hole: PlateBuilderHole,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): [number, number] {
  let [x, y] = screenToPlateMm(sx, sy, cw, ch, bw, bh, scale);
  const hLen = hole.length ?? 0;
  const hRot = hole.rotationDeg ?? 0;
  const d = hole.diameter;
  const Leff = Math.max(hLen, d);
  if (holeIsSlotted(hole)) {
    [x, y] = clampCapsuleHoleCenterToFit(x, y, Leff, d, hRot, bounds);
  } else {
    [x, y] = clampHoleCenter(x, y, d / 2, bounds);
  }
  [x, y] = snapHolePositionMm(x, y);
  if (holeIsSlotted(hole)) {
    return clampCapsuleHoleCenterToFit(x, y, Leff, d, hRot, bounds);
  }
  return clampHoleCenter(x, y, d / 2, bounds);
}

function formatDimLabel(n: number, stepMm?: number): string {
  if (stepMm && stepMm > 0) {
    const s = Math.round(n / stepMm) * stepMm;
    return `${Number.isInteger(s) ? s : s.toFixed(1)}`;
  }
  return n.toFixed(1);
}

function finalizeSlotPosition(
  sx: number,
  sy: number,
  cw: number,
  ch: number,
  bw: number,
  bh: number,
  scale: number,
  slot: PlateBuilderSlot,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): [number, number] {
  let [x, y] = screenToPlateMm(sx, sy, cw, ch, bw, bh, scale);
  [x, y] = clampSlotCenterToFit(
    x,
    y,
    slot.length,
    slot.width,
    slot.rotationDeg,
    bounds
  );
  [x, y] = snapSlotPositionMm(x, y);
  return clampSlotCenterToFit(
    x,
    y,
    slot.length,
    slot.width,
    slot.rotationDeg,
    bounds
  );
}

/**
 * Per-corner X/Y from left and bottom plate edges (integer mm, no decimals).
 */
function SlotCornerDimensions({
  corners,
  tx,
  ty,
  slotTitle,
}: {
  corners: [number, number][];
  tx: (x: number) => number;
  ty: (y: number) => number;
  slotTitle: string;
}) {
  const cornerTag = ["1", "2", "3", "4"];
  return (
    <>
      {corners.map((pt, idx) => {
        const [x, y] = pt;
        const xi = Math.round(x);
        const yi = Math.round(y);
        const hMidX = (tx(0) + tx(x)) / 2;
        const vMidY = (ty(0) + ty(y)) / 2;
        const stagger = (idx % 4) * 3;
        return (
          <Fragment key={`${slotTitle}-c${idx}`}>
            <Line
              points={[tx(0), ty(y), tx(x), ty(y)]}
              stroke={DIM_STROKE}
              strokeWidth={1}
              dash={[4, 3]}
              opacity={0.85}
              listening={false}
            />
            <Line
              points={[tx(x), ty(0), tx(x), ty(y)]}
              stroke={DIM_STROKE}
              strokeWidth={1}
              dash={[4, 3]}
              opacity={0.85}
              listening={false}
            />
            <Text
              text={`X ${xi} mm`}
              x={hMidX}
              y={ty(y) + 10 + stagger}
              fontSize={9}
              fill="#64748b"
              align="center"
              listening={false}
            />
            <Text
              text={`Y ${yi} mm`}
              x={tx(x) - 10 - stagger}
              y={vMidY}
              fontSize={9}
              fill="#64748b"
              align="right"
              listening={false}
            />
            <Text
              text={`${slotTitle} · ${cornerTag[idx] ?? idx + 1}`}
              x={tx(x) + 5}
              y={ty(y) - 12 - (idx % 2) * 2}
              fontSize={8}
              fill="#64748b"
              fontStyle="600"
              listening={false}
            />
          </Fragment>
        );
      })}
    </>
  );
}

function screenToPlateMm(
  sx: number,
  sy: number,
  cw: number,
  ch: number,
  bw: number,
  bh: number,
  scale: number
): [number, number] {
  const xMm = (sx - cw / 2) / scale + bw / 2;
  const yMm = bh / 2 - (sy - ch / 2) / scale;
  return [xMm, yMm];
}

function slotLinePointsRelative(
  ring: [number, number][],
  cx: number,
  cy: number,
  scale: number
): number[] {
  return ring.flatMap(([x, y]) => [(x - cx) * scale, (cy - y) * scale]);
}

function useCanvasSize() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 420 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const w = Math.max(320, Math.floor(r.width));
      const h = Math.max(280, Math.min(560, Math.round(w * 0.42)));
      setSize((prev) =>
        prev.w === w && prev.h === h ? prev : { w, h }
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { wrapRef, w: size.w, h: size.h };
}

function buildPlateFitTransform(
  cw: number,
  ch: number,
  plateW: number,
  plateH: number,
  marginMm: number
) {
  const xMin = -marginMm;
  const xMax = plateW + marginMm;
  const yMin = -marginMm;
  const yMax = plateH + marginMm;
  const viewW = xMax - xMin;
  const viewH = yMax - yMin;

  const scale = Math.min(
    (cw - 2 * PAD_PX) / viewW,
    (ch - 2 * PAD_PX) / viewH
  );

  const tx = (xMm: number) => cw / 2 + (xMm - plateW / 2) * scale;
  const ty = (yMm: number) => ch / 2 + (plateH / 2 - yMm) * scale;

  return { scale, tx, ty };
}

function EdgeDimensions({
  cx,
  cy,
  tx,
  ty,
  label,
  coordStepMm,
}: {
  cx: number;
  cy: number;
  tx: (x: number) => number;
  ty: (y: number) => number;
  label: string;
  /** If set (e.g. 5), labels match snapped grid for holes */
  coordStepMm?: number;
}) {
  const hMidX = (tx(0) + tx(cx)) / 2;
  const vMidY = (ty(0) + ty(cy)) / 2;
  const xs = formatDimLabel(cx, coordStepMm);
  const ys = formatDimLabel(cy, coordStepMm);
  return (
    <>
      <Line
        points={[tx(0), ty(cy), tx(cx), ty(cy)]}
        stroke={DIM_STROKE}
        strokeWidth={1}
        dash={[5, 4]}
        listening={false}
      />
      <Line
        points={[tx(cx), ty(0), tx(cx), ty(cy)]}
        stroke={DIM_STROKE}
        strokeWidth={1}
        dash={[5, 4]}
        listening={false}
      />
      <Text
        text={`X ${xs} mm`}
        x={hMidX}
        y={ty(cy) + 10}
        fontSize={10}
        fill="#64748b"
        align="center"
        listening={false}
      />
      <Text
        text={`Y ${ys} mm`}
        x={tx(cx) - 8}
        y={vMidY}
        fontSize={10}
        fill="#64748b"
        align="right"
        listening={false}
      />
      <Text
        text={label}
        x={tx(cx) + 6}
        y={ty(cy) - 14}
        fontSize={9}
        fill="#64748b"
        fontStyle="600"
        listening={false}
      />
    </>
  );
}

export interface PlatePreviewCanvasProps {
  spec: PlateBuilderSpecV1;
  /** When set, holes can be dragged; updates form cx/cy (mm, bottom-left origin). */
  onHoleCenterChange?: (index: number, cx: number, cy: number) => void;
  onSlotCenterChange?: (index: number, cx: number, cy: number) => void;
}

export function PlatePreviewCanvas({
  spec,
  onHoleCenterChange,
  onSlotCenterChange,
}: PlatePreviewCanvasProps) {
  const { wrapRef, w: cw, h: ch } = useCanvasSize();

  const bw = spec.width;
  const bh = spec.height;
  const invalidDims =
    !Number.isFinite(bw) ||
    !Number.isFinite(bh) ||
    bw <= 0 ||
    bh <= 0;

  let geo: ReturnType<typeof buildPlateGeometry> | null = null;
  if (!invalidDims) {
    try {
      geo = buildPlateGeometry(spec);
    } catch {
      geo = null;
    }
  }

  const showPlate = !invalidDims && geo != null;

  const marginMm = showPlate ? previewMarginMm(bw, bh) : 0;

  const { scale, tx, ty } = useMemo(
    () =>
      showPlate
        ? buildPlateFitTransform(cw, ch, bw, bh, marginMm)
        : {
            scale: 1,
            tx: (_x: number) => 0,
            ty: (_y: number) => 0,
          },
    [cw, ch, bw, bh, marginMm, showPlate]
  );

  const centerBounds = useMemo(
    () =>
      conservativeCenterBounds(
        spec.shapeType,
        bw,
        bh,
        spec.cornerRadius,
        spec.chamferSize
      ),
    [spec.shapeType, bw, bh, spec.cornerRadius, spec.chamferSize]
  );

  let outerPts: number[] = [];
  if (showPlate && geo) {
    outerPts = geo.outer.flatMap(([x, y]) => [tx(x), ty(y)]);
  }

  const dragHoles = Boolean(onHoleCenterChange);
  const dragSlots = Boolean(onSlotCenterChange);

  return (
    <div ref={wrapRef} className="w-full">
      <div className="relative rounded-xl border border-border bg-[#f8f9fa] overflow-hidden shadow-inner">
        <Stage width={cw} height={ch}>
          {showPlate && (
            <Layer listening={false}>
              {spec.holes.map((h, i) => (
                <EdgeDimensions
                  key={`dim-h-${h.id}`}
                  cx={h.cx}
                  cy={h.cy}
                  tx={tx}
                  ty={ty}
                  label={`Hole ${i + 1}`}
                  coordStepMm={5}
                />
              ))}
              {spec.slots.map((s, i) => (
                <SlotCornerDimensions
                  key={`dim-s-${s.id}`}
                  corners={slotCorners(
                    s.cx,
                    s.cy,
                    s.length,
                    s.width,
                    s.rotationDeg
                  )}
                  tx={tx}
                  ty={ty}
                  slotTitle={`Slot ${i + 1}`}
                />
              ))}
            </Layer>
          )}
          {showPlate && (
            <Layer listening={false}>
              <Line
                points={outerPts}
                closed
                stroke="#1d4ed8"
                strokeWidth={OUTLINE_STROKE_PX}
                lineJoin="round"
              />
            </Layer>
          )}
          {showPlate && geo && (
            <Layer>
              {geo.holeItems.map((item, i) => {
                const hole = spec.holes[i];
                if (!hole) return null;
                if (item.kind === "circle") {
                  return (
                    <Circle
                      key={`h-${hole.id}`}
                      x={tx(item.cx)}
                      y={ty(item.cy)}
                      radius={Math.max(1.25, item.radius * scale)}
                      stroke="#dc2626"
                      strokeWidth={FEATURE_STROKE_PX}
                      fill="rgba(220,38,38,0.08)"
                      draggable={dragHoles}
                      onDragMove={
                        dragHoles
                          ? (e) => {
                              if (!onHoleCenterChange) return;
                              const [cx, cy] = finalizeHolePosition(
                                e.target.x(),
                                e.target.y(),
                                cw,
                                ch,
                                bw,
                                bh,
                                scale,
                                hole,
                                centerBounds
                              );
                              e.target.position({ x: tx(cx), y: ty(cy) });
                              onHoleCenterChange(i, cx, cy);
                            }
                          : undefined
                      }
                      onDragEnd={
                        dragHoles
                          ? (e) => {
                              if (!onHoleCenterChange) return;
                              const [cx, cy] = finalizeHolePosition(
                                e.target.x(),
                                e.target.y(),
                                cw,
                                ch,
                                bw,
                                bh,
                                scale,
                                hole,
                                centerBounds
                              );
                              e.target.position({ x: tx(cx), y: ty(cy) });
                              onHoleCenterChange(i, cx, cy);
                            }
                          : undefined
                      }
                      hitStrokeWidth={HIT_WIDE}
                      cursor={dragHoles ? "grab" : "default"}
                    />
                  );
                }
                const rel = slotLinePointsRelative(
                  item.outline,
                  hole.cx,
                  hole.cy,
                  scale
                );
                return (
                  <Group
                    key={`h-${hole.id}`}
                    x={tx(hole.cx)}
                    y={ty(hole.cy)}
                    draggable={dragHoles}
                    onDragMove={
                      dragHoles
                        ? (e) => {
                            if (!onHoleCenterChange) return;
                            const [cx, cy] = finalizeHolePosition(
                              e.target.x(),
                              e.target.y(),
                              cw,
                              ch,
                              bw,
                              bh,
                              scale,
                              hole,
                              centerBounds
                            );
                            e.target.position({ x: tx(cx), y: ty(cy) });
                            onHoleCenterChange(i, cx, cy);
                          }
                        : undefined
                    }
                    onDragEnd={
                      dragHoles
                        ? (e) => {
                            if (!onHoleCenterChange) return;
                            const [cx, cy] = finalizeHolePosition(
                              e.target.x(),
                              e.target.y(),
                              cw,
                              ch,
                              bw,
                              bh,
                              scale,
                              hole,
                              centerBounds
                            );
                            e.target.position({ x: tx(cx), y: ty(cy) });
                            onHoleCenterChange(i, cx, cy);
                          }
                        : undefined
                    }
                    cursor={dragHoles ? "grab" : "default"}
                  >
                    <Line
                      points={rel}
                      closed
                      stroke="#dc2626"
                      strokeWidth={FEATURE_STROKE_PX}
                      lineJoin="round"
                      fill="rgba(220,38,38,0.06)"
                      hitStrokeWidth={HIT_WIDE}
                    />
                  </Group>
                );
              })}
              {geo.slotOutlines.map((ring, i) => {
                const slot = spec.slots[i];
                if (!slot) return null;
                const rel = slotLinePointsRelative(
                  ring,
                  slot.cx,
                  slot.cy,
                  scale
                );
                return (
                  <Group
                    key={`s-${slot.id}`}
                    x={tx(slot.cx)}
                    y={ty(slot.cy)}
                    draggable={dragSlots}
                    onDragMove={
                      dragSlots
                        ? (e) => {
                            if (!onSlotCenterChange) return;
                            const [cx, cy] = finalizeSlotPosition(
                              e.target.x(),
                              e.target.y(),
                              cw,
                              ch,
                              bw,
                              bh,
                              scale,
                              slot,
                              centerBounds
                            );
                            e.target.position({ x: tx(cx), y: ty(cy) });
                            onSlotCenterChange(i, cx, cy);
                          }
                        : undefined
                    }
                    onDragEnd={
                      dragSlots
                        ? (e) => {
                            if (!onSlotCenterChange) return;
                            const [cx, cy] = finalizeSlotPosition(
                              e.target.x(),
                              e.target.y(),
                              cw,
                              ch,
                              bw,
                              bh,
                              scale,
                              slot,
                              centerBounds
                            );
                            e.target.position({ x: tx(cx), y: ty(cy) });
                            onSlotCenterChange(i, cx, cy);
                          }
                        : undefined
                    }
                    cursor={dragSlots ? "grab" : "default"}
                  >
                    <Line
                      points={rel}
                      closed
                      stroke="#ea580c"
                      strokeWidth={FEATURE_STROKE_PX}
                      lineJoin="miter"
                      fill="rgba(234,88,12,0.06)"
                      hitStrokeWidth={HIT_WIDE}
                    />
                  </Group>
                );
              })}
            </Layer>
          )}
        </Stage>
        {!showPlate && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground"
            aria-live="polite"
          >
            {invalidDims
              ? "Enter width and height to preview the plate"
              : "Invalid plate parameters"}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        {showPlate ? (
          <>
            Preview fits plate · {bw.toLocaleString()} × {bh.toLocaleString()}{" "}
            mm · Origin bottom-left · Holes: X/Y to center (5 mm snap) · Slots:
            X/Y at each corner (1 mm snap, integers) · Blue: outline
          </>
        ) : (
          <>
            Live view scales to your width and height · Origin bottom-left
          </>
        )}
      </p>
    </div>
  );
}
