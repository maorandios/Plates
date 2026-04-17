"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import type { SegmentFaceDimEdge } from "./SegmentFaceKonvaHolesOverlay";

const ED = "quote.bendPlatePhase.editor";

export function SegmentHoleDimGuidePopover({
  open,
  edge,
  initialMm,
  anchor,
  onApply,
  onClose,
}: {
  open: boolean;
  edge: SegmentFaceDimEdge;
  initialMm: number;
  anchor: { left: number; top: number };
  onApply: (mm: number) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState(String(initialMm));

  useEffect(() => {
    if (open) setRaw(String(initialMm));
  }, [open, initialMm, edge]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const edgeLabel = {
    top: t(`${ED}.holesDimPopoverEdgeTop`),
    bottom: t(`${ED}.holesDimPopoverEdgeBottom`),
    left: t(`${ED}.holesDimPopoverEdgeLeft`),
    right: t(`${ED}.holesDimPopoverEdgeRight`),
  }[edge];

  const submit = () => {
    const n = Number.parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    onApply(n);
  };

  return (
    <div
      className="pointer-events-auto absolute z-[70] w-[min(92vw,240px)] rounded-lg border border-white/15 bg-card p-3 shadow-2xl"
      style={{
        left: anchor.left,
        top: anchor.top,
        transform: "translate(-50%, calc(-100% - 10px))",
      }}
      dir="rtl"
    >
      <Label className="text-xs font-medium text-foreground">{edgeLabel}</Label>
      <p className="mb-2 mt-0.5 text-[10px] leading-snug text-muted-foreground">
        {t(`${ED}.holesDimPopoverTitle`)}
      </p>
      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="decimal"
          className="h-9 font-mono text-sm"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "v" || e.key === "V") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") onClose();
          }}
          autoFocus
          aria-label={t(`${ED}.holesDimPopoverInputAria`)}
        />
        <Button type="button" size="sm" className="shrink-0 px-3" onClick={submit}>
          {t(`${ED}.holesDimPopoverApply`)}
        </Button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">{t(`${ED}.holesDimPopoverHint`)}</p>
    </div>
  );
}
