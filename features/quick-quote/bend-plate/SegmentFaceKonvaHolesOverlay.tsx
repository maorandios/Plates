"use client";

import { useMemo, useRef } from "react";
import { Circle, Group, Layer, Line, Rect, Stage } from "react-konva";
import type { BendSegmentHole } from "./types";
import {
  capsuleOutlineUvMm,
  clampAndSnapHoleCenterTo1Mm,
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
}

export function SegmentFaceKonvaHolesOverlay({
  layout,
  viewW,
  viewH,
  holes,
  onHolePositionChange,
  selectedHoleId = null,
  onHoleSelect,
}: SegmentFaceKonvaHolesOverlayProps) {
  const tf = useMemo(
    () => overlayTransform(layout, viewW, viewH),
    [layout, viewW, viewH]
  );

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

          /**
           * At rotation=0, rectLength runs horizontally (+u / plate width) and rectWidth
           * runs vertically (+v / segment). Matches `capsuleOutlineUvMm` (long axis on +u)
           * and `holeOutlinePolygonUvMm` for rect, so 2D, DXF and 3D all agree.
           */
          const rlMm = Math.max(0, h.rectLengthMm ?? 0);
          const rwMm = Math.max(0, h.rectWidthMm ?? 0);
          const wPx = Math.max(4, rlMm * tf.su);
          const hPx = Math.max(4, rwMm * tf.sv);
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
