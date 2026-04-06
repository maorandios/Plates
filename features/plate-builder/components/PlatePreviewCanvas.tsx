"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer } from "react-konva";
import {
  PlateKonvaPlate,
  type PlateKonvaPlateProps,
} from "./plateKonva/PlateKonvaPlate";
import type { PlateBuilderSpecV1 } from "../types";
import { buildPlateGeometry } from "../lib/buildPlateGeometry";

export type PlatePreviewCanvasProps = Omit<
  PlateKonvaPlateProps,
  "cw" | "ch"
>;

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

function invalidOverlayMessage(spec: PlateBuilderSpecV1): string {
  const bw = spec.width;
  const bh = spec.height;
  const invalidDims =
    !Number.isFinite(bw) ||
    !Number.isFinite(bh) ||
    bw <= 0 ||
    bh <= 0;
  return invalidDims
    ? "Enter width and height to preview the plate"
    : "Invalid plate parameters";
}

export function PlatePreviewCanvas(props: PlatePreviewCanvasProps) {
  const { wrapRef, w: cw, h: ch } = useCanvasSize();
  const bw = props.spec.width;
  const bh = props.spec.height;
  const invalidDims =
    !Number.isFinite(bw) ||
    !Number.isFinite(bh) ||
    bw <= 0 ||
    bh <= 0;
  let showPlate = !invalidDims;
  if (showPlate) {
    try {
      buildPlateGeometry(props.spec);
    } catch {
      showPlate = false;
    }
  }

  return (
    <div ref={wrapRef} className="w-full">
      <div className="relative rounded-xl bg-[#f8f9fa] overflow-hidden shadow-inner">
        <Stage width={cw} height={ch}>
          <Layer>
            <PlateKonvaPlate cw={cw} ch={ch} {...props} />
          </Layer>
        </Stage>
        {!showPlate && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground"
            aria-live="polite"
          >
            {invalidOverlayMessage(props.spec)}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        {showPlate ? (
          <>
            Preview fits plate · {bw.toLocaleString()} × {bh.toLocaleString()}{" "}
            mm · Origin bottom-left · Overall W/H outside outline · Hole/slot
            center dims while dragging (5 mm / 1 mm) · Blue: outline
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
