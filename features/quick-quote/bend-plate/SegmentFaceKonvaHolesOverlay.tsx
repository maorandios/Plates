"use client";

import { useMemo, useRef } from "react";
import { Circle, Group, Layer, Line, Rect, Stage } from "react-konva";
import type { BendSegmentHole } from "./types";
import {
  capsuleOutlineUvMm,
  clampAndSnapHoleCenterTo1Mm,
  holeHalfExtentsMm,
  segmentFaceEffectiveWidthMm,
} from "./segmentFaceHolesBounds";
import type { SegmentFaceSvgModel } from "./segmentFaceLayout";

const HOLE_STROKE = "#f97316";
const HOLE_STROKE_SELECTED = "#a78bfa";
const HOLE_FILL = "rgba(249,115,22,0.12)";
const HOLE_FILL_SELECTED = "rgba(167,139,250,0.18)";
const HIT_PAD_PX = 14;
/**
 * Must match Konva `dragDistance`: pointer must move this far before a drag starts.
 * Keeps taps/select from nudging UV; keeps preview size stable vs. spurious drags.
 */
const DRAG_DISTANCE_PX = 6;

const GUIDE_STROKE = "#a78bfa";
/** Solid stroke width for invisible hit targets — dashed lines have gaps that don’t receive clicks. */
const GUIDE_HIT_LINE_STROKE_W = 22;

export type SegmentFaceDimEdge = "top" | "bottom" | "left" | "right";

function clientXYFromPointerEvent(evt: Event): { x: number; y: number } {
  if ("clientX" in evt && typeof (evt as MouseEvent).clientX === "number") {
    const m = evt as MouseEvent;
    return { x: m.clientX, y: m.clientY };
  }
  const t = (evt as TouchEvent).changedTouches?.[0];
  return { x: t?.clientX ?? 0, y: t?.clientY ?? 0 };
}

/** Shorten segment [from→to] from the `to` end so it stops before the hole (clear hit targets). */
function trimTowardStart(
  from: { x: number; y: number },
  to: { x: number; y: number },
  trimFromToPx: number
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < trimFromToPx + 2) return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const t = (len - trimFromToPx) / len;
  return { x: from.x + dx * t, y: from.y + dy * t };
}

function overlayTransform(
  layout: Extract<SegmentFaceSvgModel, { kind: "ok" }>,
  viewW: number,
  viewH: number
) {
  const vbW = layout.vbW;
  const vbH = layout.vbH;
  const scale = Math.min(viewW / vbW, viewH / vbH);
  const ox = (viewW - vbW * scale) / 2;
  const oy = (viewH - vbH * scale) / 2;
  const { x: rx, y: ry, w: rw, h: rh } = layout.rect;
  const Wmm = segmentFaceEffectiveWidthMm(
    layout.plateWidthMm,
    layout.segmentLenMm,
    layout.plateWidthDrawMm
  );
  const Lmm = layout.segmentLenMm;

  const uvToStage = (u: number, v: number) => {
    const vbx = rx + (u / Wmm) * rw;
    const vby = ry + (v / Lmm) * rh;
    return { x: ox + vbx * scale, y: oy + vby * scale };
  };

  const stageToUv = (sx: number, sy: number) => {
    const vbx = (sx - ox) / scale;
    const vby = (sy - oy) / scale;
    const u = ((vbx - rx) / rw) * Wmm;
    const v = ((vby - ry) / rh) * Lmm;
    return { u, v };
  };

  const su = (rw * scale) / Wmm;
  const sv = (rh * scale) / Lmm;

  return { scale, ox, oy, uvToStage, stageToUv, Wmm, Lmm, su, sv };
}

/** Screen pixel position of a face UV point (same mapping as the holes overlay). */
export function segmentFaceHoleCenterToStagePx(
  layout: Extract<SegmentFaceSvgModel, { kind: "ok" }>,
  viewW: number,
  viewH: number,
  uMm: number,
  vMm: number
): { x: number; y: number } {
  const tf = overlayTransform(layout, viewW, viewH);
  return tf.uvToStage(uMm, vMm);
}

export interface SegmentFaceKonvaHolesOverlayProps {
  layout: Extract<SegmentFaceSvgModel, { kind: "ok" }>;
  viewW: number;
  viewH: number;
  holes: BendSegmentHole[];
  onHolePositionChange: (holeId: string, uMm: number, vMm: number) => void;
  /** Highlight and allow tap-to-select for panel editing. */
  selectedHoleId?: string | null;
  onHoleSelect?: (holeId: string) => void;
  /**
   * When a hole is selected, draw dashed guides to the four segment edges; clicking a segment
   * opens precise dimension entry in the parent (popover).
   */
  onDimensionGuideLineClick?: (
    holeId: string,
    edge: SegmentFaceDimEdge,
    clientX: number,
    clientY: number
  ) => void;
  /**
   * Dimension guides only after the user selects this hole on the canvas (tap on the hole).
   * When unset or different from `selectedHoleId`, dashed guides are hidden.
   */
  dimensionGuidesActiveHoleId?: string | null;
}

export function SegmentFaceKonvaHolesOverlay({
  layout,
  viewW,
  viewH,
  holes,
  onHolePositionChange,
  selectedHoleId = null,
  onHoleSelect,
  onDimensionGuideLineClick,
  dimensionGuidesActiveHoleId = null,
}: SegmentFaceKonvaHolesOverlayProps) {
  const tf = useMemo(
    () => overlayTransform(layout, viewW, viewH),
    [layout, viewW, viewH]
  );

  /** Konva may fire both tap and click for one mouse action — avoid double-opening the popover. */
  const lastDimGuideUiRef = useRef<{ key: string; t: number } | null>(null);
  /** Draggable holes: tap + click can both fire for one physical click. */
  const lastHoleSelectUiRef = useRef<{ id: string; t: number } | null>(null);

  if (holes.length === 0 || viewW < 8 || viewH < 8) return null;

  return (
    <Stage
      width={viewW}
      height={viewH}
      className="absolute inset-0 z-20"
      style={{ touchAction: "none" }}
    >
      <Layer>
        {holes.map((h) => {
          const p = tf.uvToStage(h.uMm, h.vMm);
          const selected = selectedHoleId === h.id;
          const stroke = selected ? HOLE_STROKE_SELECTED : HOLE_STROKE;
          const fill = selected ? HOLE_FILL_SELECTED : HOLE_FILL;
          const applyDrag = (sx: number, sy: number) => {
            const { u, v } = tf.stageToUv(sx, sy);
            const [uc, vc] = clampAndSnapHoleCenterTo1Mm(
              u,
              v,
              h,
              tf.Wmm,
              tf.Lmm
            );
            const np = tf.uvToStage(uc, vc);
            return { ...np, uc, vc };
          };

          const finalizeDrag = (sx: number, sy: number) => {
            const r = applyDrag(sx, sy);
            onHolePositionChange(h.id, r.uc, r.vc);
            return r;
          };

          const handleDragEnd = (sx: number, sy: number) => {
            const r = applyDrag(sx, sy);
            onHolePositionChange(h.id, r.uc, r.vc);
            return r;
          };

          const emitHoleSelect = () => {
            if (!onHoleSelect) return;
            const now = Date.now();
            const prev = lastHoleSelectUiRef.current;
            if (prev && prev.id === h.id && now - prev.t < 420) return;
            lastHoleSelectUiRef.current = { id: h.id, t: now };
            onHoleSelect(h.id);
          };
          const onHoleSelectEv = (e: { cancelBubble?: boolean }) => {
            e.cancelBubble = true;
            emitHoleSelect();
          };

          if (h.kind === "round") {
            const rPx = Math.max(
              3,
              (h.diameterMm / 2) * Math.min(tf.su, tf.sv)
            );
            return (
              <Circle
                key={h.id}
                x={p.x}
                y={p.y}
                radius={rPx}
                stroke={stroke}
                strokeWidth={selected ? 2 : 1.25}
                fill={fill}
                draggable
                dragDistance={DRAG_DISTANCE_PX}
                onDragMove={(e) => {
                  const r = finalizeDrag(e.target.x(), e.target.y());
                  e.target.position({ x: r.x, y: r.y });
                }}
                onDragEnd={(e) => {
                  const r = handleDragEnd(e.target.x(), e.target.y());
                  e.target.position({ x: r.x, y: r.y });
                }}
                onTap={onHoleSelectEv}
                onClick={onHoleSelectEv}
                hitStrokeWidth={HIT_PAD_PX}
                cursor="grab"
              />
            );
          }

          if (h.kind === "oval") {
            const outline = capsuleOutlineUvMm(h.uMm, h.vMm, h);
            const flat = outline.flatMap(([u, v]) => {
              const s = tf.uvToStage(u, v);
              return [s.x - p.x, s.y - p.y];
            });
            return (
              <Group
                key={h.id}
                x={p.x}
                y={p.y}
                draggable
                dragDistance={DRAG_DISTANCE_PX}
                onDragMove={(e) => {
                  const r = finalizeDrag(e.target.x(), e.target.y());
                  e.target.position({ x: r.x, y: r.y });
                }}
                onDragEnd={(e) => {
                  const r = handleDragEnd(e.target.x(), e.target.y());
                  e.target.position({ x: r.x, y: r.y });
                }}
                onTap={onHoleSelectEv}
                onClick={onHoleSelectEv}
                cursor="grab"
              >
                <Line
                  points={flat}
                  closed
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={selected ? 2 : 1.25}
                  lineJoin="round"
                  hitStrokeWidth={HIT_PAD_PX}
                />
              </Group>
            );
          }

          const wMm = Math.max(0, h.rectWidthMm ?? 0);
          const lenMm = Math.max(0, h.rectLengthMm ?? 0);
          const wPx = Math.max(4, wMm * tf.su);
          const hPx = Math.max(4, lenMm * tf.sv);
          const rot = h.rotationDeg ?? 0;
          return (
            <Group
              key={h.id}
              x={p.x}
              y={p.y}
              draggable
              dragDistance={DRAG_DISTANCE_PX}
              onDragMove={(e) => {
                const r = finalizeDrag(e.target.x(), e.target.y());
                e.target.position({ x: r.x, y: r.y });
              }}
              onDragEnd={(e) => {
                const r = handleDragEnd(e.target.x(), e.target.y());
                e.target.position({ x: r.x, y: r.y });
              }}
              onTap={onHoleSelectEv}
              onClick={onHoleSelectEv}
              cursor="grab"
            >
              <Rect
                width={wPx}
                height={hPx}
                offsetX={wPx / 2}
                offsetY={hPx / 2}
                rotation={rot}
                stroke={stroke}
                strokeWidth={selected ? 2 : 1.25}
                fill={fill}
                hitStrokeWidth={HIT_PAD_PX}
              />
            </Group>
          );
        })}
      </Layer>

      {selectedHoleId &&
      dimensionGuidesActiveHoleId === selectedHoleId &&
      onDimensionGuideLineClick ? (
        <Layer>
          {(() => {
            const h = holes.find((x) => x.id === selectedHoleId);
            if (!h) return null;
            const pc = tf.uvToStage(h.uMm, h.vMm);
            const pLeft = tf.uvToStage(0, h.vMm);
            const pRight = tf.uvToStage(tf.Wmm, h.vMm);
            const pTop = tf.uvToStage(h.uMm, 0);
            const pBot = tf.uvToStage(h.uMm, tf.Lmm);
            const { hu, hv } = holeHalfExtentsMm(h);
            const trimPx =
              Math.max(10, Math.hypot(hu * tf.su, hv * tf.sv) + 8);
            const qLeft = trimTowardStart(pLeft, pc, trimPx);
            const qRight = trimTowardStart(pRight, pc, trimPx);
            const qTop = trimTowardStart(pTop, pc, trimPx);
            const qBot = trimTowardStart(pBot, pc, trimPx);
            const dash = [6, 5];
            const emit =
              (edge: SegmentFaceDimEdge) =>
              (e: { evt: Event; cancelBubble?: boolean }) => {
                e.cancelBubble = true;
                e.evt.stopPropagation?.();
                const dedupeKey = `${h.id}:${edge}`;
                const now = Date.now();
                const prev = lastDimGuideUiRef.current;
                if (
                  prev &&
                  prev.key === dedupeKey &&
                  now - prev.t < 280
                ) {
                  return;
                }
                lastDimGuideUiRef.current = { key: dedupeKey, t: now };
                const { x, y } = clientXYFromPointerEvent(e.evt);
                onDimensionGuideLineClick(h.id, edge, x, y);
              };
            /** Visible dash drawn first; wide hit line on top so clicks hit a listening shape directly. */
            const guidePair = (
              pts: number[],
              edge: SegmentFaceDimEdge
            ) => (
              <>
                <Line
                  points={pts}
                  stroke={GUIDE_STROKE}
                  strokeWidth={1.25}
                  dash={dash}
                  opacity={0.95}
                  lineCap="round"
                  listening={false}
                  perfectDrawEnabled={false}
                />
                <Line
                  points={pts}
                  stroke="rgba(0,0,0,0.004)"
                  strokeWidth={GUIDE_HIT_LINE_STROKE_W}
                  lineCap="round"
                  listening
                  perfectDrawEnabled={false}
                  onTap={emit(edge)}
                  onClick={emit(edge)}
                  cursor="pointer"
                />
              </>
            );
            return (
              <>
                {guidePair([pLeft.x, pLeft.y, qLeft.x, qLeft.y], "left")}
                {guidePair([qRight.x, qRight.y, pRight.x, pRight.y], "right")}
                {guidePair([pTop.x, pTop.y, qTop.x, qTop.y], "top")}
                {guidePair([pBot.x, pBot.y, qBot.x, qBot.y], "bottom")}
              </>
            );
          })()}
        </Layer>
      ) : null}
    </Stage>
  );
}

/** Re-clamp all holes when dimensions change (caller merges into state). */
export function reclampSegmentHolesToFace(
  holes: BendSegmentHole[],
  plateWidthMm: number,
  segmentLenMm: number,
  plateWidthDrawMm: number
): BendSegmentHole[] {
  const W = segmentFaceEffectiveWidthMm(
    plateWidthMm,
    segmentLenMm,
    plateWidthDrawMm
  );
  const L = Math.max(segmentLenMm, 1e-6);
  return holes.map((h) => {
    const [u, v] = clampAndSnapHoleCenterTo1Mm(h.uMm, h.vMm, h, W, L);
    return u === h.uMm && v === h.vMm ? h : { ...h, uMm: u, vMm: v };
  });
}
