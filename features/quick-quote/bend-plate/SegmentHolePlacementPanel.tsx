"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Circle, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BendSegmentHole, BendSegmentHoleKind } from "./types";
import {
  bendHoleWithNewKind,
  clampAndSnapHoleCenterTo1Mm,
  clampHoleCenterUv,
  holeFitsOnSegmentFace,
  resolvedOvalLengthMm,
} from "./segmentFaceHolesBounds";

const ED = "quote.bendPlatePhase.editor";

const DECIMAL_TYPING = /^-?\d*\.?\d*$/;

const HOLE_KINDS: BendSegmentHoleKind[] = ["round", "oval", "rect"];

/** Which control triggered “hole larger than face” so we can show copy under it. */
type OversizeFieldKey =
  | "kind"
  | "diameter"
  | "ovalLength"
  | "rotation"
  | "rectLength"
  | "rectWidth";

function HoleKindGlyph({
  kind,
  className,
}: {
  kind: BendSegmentHoleKind;
  className?: string;
}) {
  const c = cn("shrink-0 text-current", className);
  if (kind === "round") {
    return <Circle className={c} strokeWidth={1.75} aria-hidden />;
  }
  if (kind === "rect") {
    return <Square className={c} strokeWidth={1.75} aria-hidden />;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={c}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <ellipse cx="12" cy="12" rx="10" ry="6" />
    </svg>
  );
}

/** Same behavior as `NumField` in BendPlateBuilder — decimal typing + min clamp on blur. */
function PlacementNumField({
  label,
  value,
  onChange,
  min,
  className,
  invalid,
  errorText,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  className?: string;
  invalid?: boolean;
  errorText?: string;
}) {
  const errId = useId();
  const [focused, setFocused] = useState(false);
  const [local, setLocal] = useState("");

  const display = focused
    ? local
    : Number.isFinite(value)
      ? String(value)
      : "";

  useEffect(() => {
    if (focused) return;
    const id = window.setTimeout(() => {
      setLocal(Number.isFinite(value) ? String(value) : "");
    }, 0);
    return () => window.clearTimeout(id);
  }, [value, focused]);

  const commitBlur = () => {
    setFocused(false);
    const raw = local.trim();
    if (raw === "" || raw === "-") {
      const fallback = min !== undefined ? min : 0;
      onChange(fallback);
      return;
    }
    let n = parseFloat(raw);
    if (Number.isNaN(n)) {
      n = Number.isFinite(value) ? value : min !== undefined ? min : 0;
    } else if (min !== undefined) {
      n = Math.max(min, n);
    }
    onChange(n);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(
          "h-9 tabular-nums text-sm",
          invalid && "border-destructive ring-1 ring-destructive/35"
        )}
        aria-invalid={invalid}
        aria-describedby={errorText ? errId : undefined}
        value={display}
        onFocus={() => {
          setFocused(true);
          setLocal(Number.isFinite(value) ? String(value) : "");
        }}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw !== "" && !DECIMAL_TYPING.test(raw)) return;
          setLocal(raw);
          if (raw === "" || raw === "-") return;
          const n = parseFloat(raw);
          if (!Number.isNaN(n)) {
            onChange(n);
          }
        }}
        onBlur={commitBlur}
        aria-valuemin={min}
      />
      {errorText ? (
        <p id={errId} className="text-[11px] leading-snug text-destructive" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

function parseMm(raw: string): number | null {
  const n = Number.parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function fmtMm(n: number): string {
  return String(Math.round(n));
}

type DimEdge = "left" | "right" | "top" | "bottom";

/** Square plate, hole at center, dashed lines from hole to each edge (diagram only). */
function HolePlacementSchematic({ hole }: { hole: BendSegmentHole }) {
  const pad = 8;
  const side = 100 - 2 * pad;
  const x0 = pad;
  const y0 = pad;
  const cx = 50;
  const cy = 50;
  const stroke = "#f97316";
  const fill = "rgba(249,115,22,0.15)";
  const dash = "5 4";

  const holeNode = (() => {
    const r = 7;
    if (hole.kind === "round") {
      return (
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
      );
    }
    if (hole.kind === "oval") {
      return (
        <ellipse
          cx={cx}
          cy={cy}
          rx={Math.max(6, r * 1.3)}
          ry={Math.max(5, r * 0.72)}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
        />
      );
    }
    const w = 14;
    const h = 11;
    return (
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        transform={`rotate(${hole.rotationDeg ?? 0} ${cx} ${cy})`}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
    );
  })();

  const x1 = x0 + side;
  const y1 = y0 + side;

  return (
    <svg
      className="h-full w-full max-h-[min(28vw,7.5rem)] min-h-[5.5rem]"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t(`${ED}.holesPlacementSchematicAria`)}
    >
      <rect
        x={x0}
        y={y0}
        width={side}
        height={side}
        rx={2}
        fill="none"
        stroke="hsl(262 92% 55%)"
        strokeWidth={1.2}
      />
      <line
        x1={x0}
        y1={cy}
        x2={cx}
        y2={cy}
        stroke="#a78bfa"
        strokeWidth={1}
        strokeDasharray={dash}
        opacity={0.9}
      />
      <line
        x1={cx}
        y1={cy}
        x2={x1}
        y2={cy}
        stroke="#a78bfa"
        strokeWidth={1}
        strokeDasharray={dash}
        opacity={0.9}
      />
      <line
        x1={cx}
        y1={y0}
        x2={cx}
        y2={cy}
        stroke="#a78bfa"
        strokeWidth={1}
        strokeDasharray={dash}
        opacity={0.9}
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={y1}
        stroke="#a78bfa"
        strokeWidth={1}
        strokeDasharray={dash}
        opacity={0.9}
      />
      {holeNode}
    </svg>
  );
}

function EdgeInput({
  edge,
  value,
  onFocus,
  onChange,
  onBlur,
  ariaLabel,
}: {
  edge: DimEdge;
  value: string;
  onFocus: () => void;
  onChange: (raw: string) => void;
  onBlur: () => void;
  ariaLabel: string;
}) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      data-edge={edge}
      className="h-8 w-[3.75rem] border-border bg-background/90 px-1.5 text-center font-mono text-xs tabular-nums shadow-sm"
      value={value}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder="מ״מ"
      aria-label={ariaLabel}
    />
  );
}

export function SegmentHolePlacementPanel({
  open,
  hole,
  widthMm,
  lengthMm,
  onComplete,
  onCancel,
  onPatchHole,
  onReplaceHole,
  onDeleteHole,
}: {
  open: boolean;
  hole: BendSegmentHole | null;
  widthMm: number;
  lengthMm: number;
  onComplete: (uMm: number, vMm: number) => void;
  onCancel: () => void;
  onPatchHole: (patch: Partial<BendSegmentHole>) => void;
  onReplaceHole: (next: BendSegmentHole) => void;
  onDeleteHole: () => void;
}) {
  const W = Math.max(widthMm, 1e-6);
  const L = Math.max(lengthMm, 1e-6);

  const [u, setU] = useState(() => hole?.uMm ?? 0);
  const [v, setV] = useState(() => hole?.vMm ?? 0);
  const [edit, setEdit] = useState<{ edge: DimEdge; text: string } | null>(null);
  const [oversizeField, setOversizeField] = useState<OversizeFieldKey | null>(null);

  useEffect(() => {
    if (!open || !hole) return;
    const t = window.setTimeout(() => {
      setU(hole.uMm);
      setV(hole.vMm);
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, hole, hole?.id, hole?.uMm, hole?.vMm]);

  useEffect(() => {
    setOversizeField(null);
  }, [open, hole?.id]);

  const dims = useMemo(() => {
    return {
      left: u,
      right: W - u,
      top: v,
      bottom: L - v,
    };
  }, [u, v, W, L]);

  const applyEdgeMm = useCallback(
    (edge: DimEdge, mm: number) => {
      if (!hole) return;
      let nu = u;
      let nv = v;
      switch (edge) {
        case "left":
          nu = mm;
          break;
        case "right":
          nu = W - mm;
          break;
        case "top":
          nv = mm;
          break;
        case "bottom":
          nv = L - mm;
          break;
      }
      const [cu, cv] = clampHoleCenterUv(nu, nv, hole, W, L);
      setU(cu);
      setV(cv);
    },
    [hole, u, v, W, L]
  );

  const displayFor = useCallback(
    (edge: DimEdge): string => {
      if (edit?.edge === edge) return edit.text;
      switch (edge) {
        case "left":
          return fmtMm(dims.left);
        case "right":
          return fmtMm(dims.right);
        case "top":
          return fmtMm(dims.top);
        case "bottom":
          return fmtMm(dims.bottom);
      }
    },
    [edit, dims]
  );

  const onFieldFocus = (edge: DimEdge) => {
    let n = 0;
    switch (edge) {
      case "left":
        n = dims.left;
        break;
      case "right":
        n = dims.right;
        break;
      case "top":
        n = dims.top;
        break;
      case "bottom":
        n = dims.bottom;
        break;
    }
    setEdit({ edge, text: fmtMm(n) });
  };

  const onFieldChange = (edge: DimEdge, raw: string) => {
    setEdit({ edge, text: raw });
    const n = parseMm(raw);
    if (n === null) return;
    applyEdgeMm(edge, n);
  };

  const onFieldBlur = () => {
    setEdit(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const oversizeMsg = t(`${ED}.holesOversizeFace`);

  const safePatch = useCallback(
    (patch: Partial<BendSegmentHole>, field: OversizeFieldKey) => {
      if (!hole) return;
      const next = { ...hole, ...patch };
      if (!holeFitsOnSegmentFace(next, W, L)) {
        setOversizeField(field);
        return;
      }
      setOversizeField(null);
      onPatchHole(patch);
    },
    [hole, W, L, onPatchHole]
  );

  const safeReplace = useCallback(
    (nextHole: BendSegmentHole, field: OversizeFieldKey) => {
      if (!hole) return;
      const next = { ...nextHole, id: hole.id };
      if (!holeFitsOnSegmentFace(next, W, L)) {
        setOversizeField(field);
        return;
      }
      setOversizeField(null);
      onReplaceHole(next);
    },
    [hole, W, L, onReplaceHole]
  );

  if (!open || !hole) return null;

  const edgeAria = {
    top: t(`${ED}.holesDimPopoverEdgeTop`),
    bottom: t(`${ED}.holesDimPopoverEdgeBottom`),
    left: t(`${ED}.holesDimPopoverEdgeLeft`),
    right: t(`${ED}.holesDimPopoverEdgeRight`),
  };

  const submit = () => {
    const [uc, vc] = clampAndSnapHoleCenterTo1Mm(u, v, hole, W, L);
    onComplete(uc, vc);
  };

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-1/2 z-[70] max-h-[min(85vh,calc(100%-2rem))] w-[min(94vw,320px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card/98 p-3 shadow-2xl backdrop-blur-sm"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={t(`${ED}.holesPlacementPanelTitle`)}
    >
      {/* LTR so “left/right” match the schematic; Hebrew title/buttons stay RTL on the card */}
      <div className="mx-auto w-full max-w-[220px] select-none" dir="ltr">
        <div
          className="grid w-full items-center justify-items-center gap-x-1.5 gap-y-1"
          style={{
            gridTemplateColumns: "minmax(2.85rem,auto) minmax(0,1fr) minmax(2.85rem,auto)",
            gridTemplateRows: "auto minmax(5.75rem,auto) auto",
          }}
        >
          <div className="col-start-2 row-start-1 w-full max-w-[4.25rem] justify-self-center">
            <EdgeInput
              edge="top"
              value={displayFor("top")}
              onFocus={() => onFieldFocus("top")}
              onChange={(raw) => onFieldChange("top", raw)}
              onBlur={onFieldBlur}
              ariaLabel={edgeAria.top}
            />
          </div>
          <div className="col-start-1 row-start-2 flex justify-end">
            <EdgeInput
              edge="left"
              value={displayFor("left")}
              onFocus={() => onFieldFocus("left")}
              onChange={(raw) => onFieldChange("left", raw)}
              onBlur={onFieldBlur}
              ariaLabel={edgeAria.left}
            />
          </div>
          <div className="col-start-2 row-start-2 flex min-h-0 w-full min-w-0 items-center justify-center">
            <HolePlacementSchematic hole={hole} />
          </div>
          <div className="col-start-3 row-start-2 flex justify-start">
            <EdgeInput
              edge="right"
              value={displayFor("right")}
              onFocus={() => onFieldFocus("right")}
              onChange={(raw) => onFieldChange("right", raw)}
              onBlur={onFieldBlur}
              ariaLabel={edgeAria.right}
            />
          </div>
          <div className="col-start-2 row-start-3 w-full max-w-[4.25rem] justify-self-center">
            <EdgeInput
              edge="bottom"
              value={displayFor("bottom")}
              onFocus={() => onFieldFocus("bottom")}
              onChange={(raw) => onFieldChange("bottom", raw)}
              onBlur={onFieldBlur}
              ariaLabel={edgeAria.bottom}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <div className="space-y-2">
          <Label className="text-xs font-normal text-muted-foreground" id="hole-kind-picker-label">
            {t(`${ED}.holesKind`)}
          </Label>
          <div
            className="grid grid-cols-3 gap-2"
            role="group"
            aria-labelledby="hole-kind-picker-label"
          >
            {HOLE_KINDS.map((k) => {
              const active = hole.kind === k;
              const label =
                k === "round"
                  ? t(`${ED}.holesKindRound`)
                  : k === "oval"
                    ? t(`${ED}.holesKindOval`)
                    : t(`${ED}.holesKindRect`);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => safeReplace(bendHoleWithNewKind(hole, k), "kind")}
                  className={cn(
                    "flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "border-primary bg-primary/12 text-foreground shadow-sm"
                      : "border-border bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                  )}
                  aria-pressed={active}
                  aria-label={label}
                >
                  <HoleKindGlyph kind={k} className="h-7 w-7" />
                  <span className="max-w-full truncate text-[10px] font-medium leading-tight">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          {oversizeField === "kind" ? (
            <p className="mt-2 text-[11px] leading-snug text-destructive" role="alert">
              {oversizeMsg}
            </p>
          ) : null}
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t(`${ED}.holesDims`)}
        </p>

        {hole.kind === "round" ? (
          <PlacementNumField
            label={t(`${ED}.holesDiameter`)}
            value={hole.diameterMm}
            onChange={(n) => safePatch({ diameterMm: Math.max(0, n) }, "diameter")}
            min={0}
            invalid={oversizeField === "diameter"}
            errorText={oversizeField === "diameter" ? oversizeMsg : undefined}
          />
        ) : null}

        {hole.kind === "oval" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PlacementNumField
                label={t(`${ED}.holesDiameter`)}
                value={hole.diameterMm}
                onChange={(n) => {
                  const d = Math.max(0, n);
                  const prevLen = resolvedOvalLengthMm(hole);
                  safePatch(
                    {
                      diameterMm: d,
                      ovalLengthMm: Math.max(prevLen, d),
                    },
                    "diameter"
                  );
                }}
                min={0}
                invalid={oversizeField === "diameter"}
                errorText={oversizeField === "diameter" ? oversizeMsg : undefined}
              />
              <PlacementNumField
                label={t(`${ED}.holesOvalLength`)}
                value={resolvedOvalLengthMm(hole)}
                onChange={(n) => {
                  const d = hole.diameterMm;
                  safePatch({ ovalLengthMm: Math.max(d, n) }, "ovalLength");
                }}
                min={0}
                invalid={oversizeField === "ovalLength"}
                errorText={oversizeField === "ovalLength" ? oversizeMsg : undefined}
              />
            </div>
            <PlacementNumField
              label={t(`${ED}.holesRotation`)}
              value={hole.rotationDeg ?? 0}
              onChange={(n) =>
                safePatch(
                  {
                    rotationDeg: Math.min(180, Math.max(-180, n)),
                  },
                  "rotation"
                )
              }
              min={-180}
              invalid={oversizeField === "rotation"}
              errorText={oversizeField === "rotation" ? oversizeMsg : undefined}
            />
          </div>
        ) : null}

        {hole.kind === "rect" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PlacementNumField
                label={t(`${ED}.holesLength`)}
                value={hole.rectLengthMm ?? 0}
                onChange={(n) => safePatch({ rectLengthMm: Math.max(0, n) }, "rectLength")}
                min={0}
                invalid={oversizeField === "rectLength"}
                errorText={oversizeField === "rectLength" ? oversizeMsg : undefined}
              />
              <PlacementNumField
                label={t(`${ED}.holesWidth`)}
                value={hole.rectWidthMm ?? 0}
                onChange={(n) => safePatch({ rectWidthMm: Math.max(0, n) }, "rectWidth")}
                min={0}
                invalid={oversizeField === "rectWidth"}
                errorText={oversizeField === "rectWidth" ? oversizeMsg : undefined}
              />
            </div>
            <PlacementNumField
              label={t(`${ED}.holesRotation`)}
              value={hole.rotationDeg ?? 0}
              onChange={(n) =>
                safePatch(
                  {
                    rotationDeg: Math.min(180, Math.max(-180, n)),
                  },
                  "rotation"
                )
              }
              min={-180}
              invalid={oversizeField === "rotation"}
              errorText={oversizeField === "rotation" ? oversizeMsg : undefined}
            />
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDeleteHole}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {t(`${ED}.holesDeleteHoleButton`)}
        </Button>
      </div>

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          {t(`${ED}.holesPlacementCancel`)}
        </Button>
        <Button type="button" className="flex-1" onClick={submit}>
          {t(`${ED}.holesPlacementComplete`)}
        </Button>
      </div>
    </div>
  );
}
