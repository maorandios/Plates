"use client";

import type { LucideIcon } from "lucide-react";

/** One row in a method-phase sidebar — large value typography (matches manual / excel import split layout). */
export function MethodPhaseMetricStrip({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-5 py-5 sm:px-7 sm:py-6">
      {Icon ? (
        <Icon
          className="h-5 w-5 shrink-0 text-muted-foreground/55 sm:h-6 sm:w-6"
          strokeWidth={1.75}
          aria-hidden
        />
      ) : null}
      <p
        className="font-semibold tabular-nums tracking-tight text-foreground leading-none
          text-[clamp(2rem,6.5vmin,4.25rem)]"
      >
        {value}
      </p>
      <p className="text-[11px] font-semibold leading-snug tracking-wide text-muted-foreground pt-1 max-w-[18rem]">
        {label}
      </p>
    </div>
  );
}
