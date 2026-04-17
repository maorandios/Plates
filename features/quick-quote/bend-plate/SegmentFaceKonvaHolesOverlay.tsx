"use client";

import { useMemo, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { formatInteger } from "@/lib/formatNumbers";
import type { BendSegmentHole } from "./types";
import {
  capsuleOutlineUvMm,
  clampAndSnapHoleCenterTo1Mm,
  segmentFaceEffectiveWidthMm,
} from "./segmentFaceHolesBounds";
import type { SegmentFaceSvgModel } from "./segmentFaceLayout";

const HOLE_STROKE = "#f97316";
const HOLE_FILL = "rgba(249,115,22,0.12)";
const HIT_PAD_PX = 14;
const DIM_STROKE = "#94a3b8";
const DIM_FONT = 11;
const DIM_GAP = 12;

function fmtDimMm(n: number): string {
  return `${formatInteger(Math.round(n))} mm`;
}

function estTextHalfSize(text: string, fontSize: number): { w: number; h: number } {
  return {
    w: (text.length * fontSize * 0.52) / 2,
    h: (fontSize * 1.1) / 2,
  };
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

type OverlayTf = ReturnType<typeof overlayTransform>;

function HoleCenterToEdgeDimensions({
  uMm,
  vMm,
  Wmm,
  Lmm,
  tf,
}: {
  uMm: number;
  vMm: number;
  Wmm: number;
  Lmm: number;
  tf: OverlayTf;
}) {
  const px = tf.uvToStage(uMm, vMm).x;
  const py = tf.uvToStage(uMm, vMm).y;
  const leftX = tf.uvToStage(0, vMm).x;
  const rightX = tf.uvToStage(Wmm, vMm).x;
  const topY = tf.uvToStage(uMm, 0).y;
  const bottomY = tf.uvToStage(uMm, Lmm).y;

  const leftMm = uMm;
  const rightMm = Wmm - uMm;
  const topMm = vMm;
  const bottomMm = Lmm - vMm;

  const leftText = fmtDimMm(leftMm);
  const rightText = fmtDimMm(rightMm);
  const topText = fmtDimMm(topMm);
  const bottomText = fmtDimMm(bottomMm);

  const midLeftX = (leftX + px) / 2;
  const midRightX = (px + rightX) / 2;
  const midTopY = (topY + py) / 2;
  const midBottomY = (py + bottomY) / 2;

  const lw = estTextHalfSize(leftText, DIM_FONT);
  const rw = estTextHalfSize(rightText, DIM_FONT);
  const tw = estTextHalfSize(topText, DIM_FONT);
  const bw = estTextHalfSize(bottomText, DIM_FONT);

  const dash = [5, 4];
  const strokeW = 1;

  return (
    <>
      <Line
        points={[leftX, py, rightX, py]}
        stroke={DIM_STROKE}
        strokeWidth={strokeW}
        dash={dash}
        opacity={0.95}
        lineCap="round"
        listening={false}
      />
      <Line
        points={[px, topY, px, bottomY]}
        stroke={DIM_STROKE}
        strokeWidth={strokeW}
        dash={dash}
        opacity={0.95}
        lineCap="round"
        listening={false}
      />
      <Text
        text={leftText}
        x={midLeftX}
        y={py + DIM_GAP + lw.h}
        fontSize={DIM_FONT}
        fill={DIM_STROKE}
        offsetX={lw.w}
        offsetY={lw.h}
        listening={false}
      />
      <Text
        text={rightText}
        x={midRightX}
        y={py - DIM_GAP - rw.h}
        fontSize={DIM_FONT}
        fill={DIM_STROKE}
        offsetX={rw.w}
        offsetY={rw.h}
        listening={false}
      />
      <Text
        text={topText}
        x={px - DIM_GAP - tw.w}
        y={midTopY}
        fontSize={DIM_FONT}
        fill={DIM_STROKE}
        offsetX={tw.w}
        offsetY={tw.h}
        rotation={-90}
        listening={false}
      />
      <Text
        text={bottomText}
        x={px + DIM_GAP + bw.w}
        y={midBottomY}
        fontSize={DIM_FONT}
        fill={DIM_STROKE}
        offsetX={bw.w}
        offsetY={bw.h}
        rotation={-90}
        listening={false}
      />
    </>
  );
}

export interface SegmentFaceKonvaHolesOverlayProps {
  layout: Extract<SegmentFaceSvgModel, { kind: "ok" }>;
  viewW: number;
  viewH: number;
  holes: BendSegmentHole[];
  onHolePositionChange: (holeId: string, uMm: number, vMm: number) => void;
}

export function SegmentFaceKonvaHolesOverlay({
  layout,
  viewW,
  viewH,
  holes,
  onHolePositionChange,
}: SegmentFaceKonvaHolesOverlayProps) {
  const tf = useMemo(
    () => overlayTransform(layout, viewW, viewH),
    [layout, viewW, viewH]
  );

  const [dragLive, setDragLive] = useState<{ u: number; v: number } | null>(null);

  if (holes.length === 0 || viewW < 8 || viewH < 8) return null;

  return (
    <Stage
      width={viewW}
      height={viewH}
      className="absolute inset-0 z-[1]"
      style={{ touchAction: "none" }}
    >
      <Layer listening={false}>
        {dragLive ? (
          <HoleCenterToEdgeDimensions
            uMm={dragLive.u}
            vMm={dragLive.v}
            Wmm={tf.Wmm}
            Lmm={tf.Lmm}
            tf={tf}
          />
        ) : null}
      </Layer>
      <Layer>
        {holes.map((h) => {
          const p = tf.uvToStage(h.uMm, h.vMm);
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

          const onDragStart = () => {
            setDragLive({ u: h.uMm, v: h.vMm });
          };

          const onDragMove = (sx: number, sy: number) => {
            const r = finalizeDrag(sx, sy);
            setDragLive({ u: r.uc, v: r.vc });
            return r;
          };

          const onDragEnd = (sx: number, sy: number) => {
            const r = finalizeDrag(sx, sy);
            setDragLive(null);
            return r;
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
                stroke={HOLE_STROKE}
                strokeWidth={1.25}
                fill={HOLE_FILL}
                draggable
                onDragStart={onDragStart}
                onDragMove={(e) => {
                  const r = onDragMove(e.target.x(), e.target.y());
                  e.target.position({ x: r.x, y: r.y });
                }}
                onDragEnd={(e) => {
                  const r = onDragEnd(e.target.x(), e.target.y());
                  e.target.position({ x: r.x, y: r.y });
                }}
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
                onDragStart={onDragStart}
                onDragMove={(e) => {
                  const r = onDragMove(e.target.x(), e.target.y());
                  e.target.position({ x: r.x, y: r.y });
                }}
                onDragEnd={(e) => {
                  const r = onDragEnd(e.target.x(), e.target.y());
                  e.target.position({ x: r.x, y: r.y });
                }}
                cursor="grab"
              >
                <Line
                  points={flat}
                  closed
                  fill={HOLE_FILL}
                  stroke={HOLE_STROKE}
                  strokeWidth={1.25}
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
              onDragStart={onDragStart}
              onDragMove={(e) => {
                const r = onDragMove(e.target.x(), e.target.y());
                e.target.position({ x: r.x, y: r.y });
              }}
              onDragEnd={(e) => {
                const r = onDragEnd(e.target.x(), e.target.y());
                e.target.position({ x: r.x, y: r.y });
              }}
              cursor="grab"
            >
              <Rect
                width={wPx}
                height={hPx}
                offsetX={wPx / 2}
                offsetY={hPx / 2}
                rotation={rot}
                stroke={HOLE_STROKE}
                strokeWidth={1.25}
                fill={HOLE_FILL}
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
