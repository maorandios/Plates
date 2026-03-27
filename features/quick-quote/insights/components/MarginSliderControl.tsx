"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  INSIGHTS_MARGIN_MAX,
  INSIGHTS_MARGIN_MIN,
  INSIGHTS_SLIDER_STEP,
} from "../quoteInsights.mock";
import { clampMargin, safeNumber } from "../quoteInsights.utils";

interface MarginSliderControlProps {
  value: number;
  onChange: (marginPercent: number) => void;
  id?: string;
}

export function MarginSliderControl({
  value,
  onChange,
  id = "quote-insights-margin",
}: MarginSliderControlProps) {
  const v = clampMargin(value);

  function apply(next: number) {
    const n = safeNumber(next, v);
    const stepped = Number.isFinite(n) ? Math.round(n) : v;
    onChange(clampMargin(stepped));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Target margin on base cost
          </Label>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {v}
            <span className="text-lg font-medium text-muted-foreground ml-0.5">%</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-input`} className="text-xs text-muted-foreground sr-only">
            Margin percent
          </Label>
          <Input
            id={`${id}-input`}
            type="number"
            min={INSIGHTS_MARGIN_MIN}
            max={INSIGHTS_MARGIN_MAX}
            step={INSIGHTS_SLIDER_STEP}
            className="h-9 w-[4.5rem] font-mono text-sm tabular-nums"
            value={Number.isFinite(value) ? value : v}
            onChange={(e) => apply(safeNumber(Number(e.target.value), v))}
            onBlur={(e) => apply(safeNumber(Number(e.target.value), v))}
          />
          <span className="text-xs text-muted-foreground tabular-nums">%</span>
        </div>
      </div>

      <div className="space-y-2">
        <input
          id={id}
          type="range"
          min={INSIGHTS_MARGIN_MIN}
          max={INSIGHTS_MARGIN_MAX}
          step={INSIGHTS_SLIDER_STEP}
          value={v}
          onChange={(e) => apply(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-foreground"
          aria-valuemin={INSIGHTS_MARGIN_MIN}
          aria-valuemax={INSIGHTS_MARGIN_MAX}
          aria-valuenow={v}
          aria-label="Adjust margin percent"
        />
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
          <span>{INSIGHTS_MARGIN_MIN}%</span>
          <span>{INSIGHTS_MARGIN_MAX}%</span>
        </div>
      </div>
    </div>
  );
}
