"use client";

import type { LucideIcon } from "lucide-react";

/** One row in a method-phase sidebar — large value typography (matches manual / excel import split layout). */
export function MethodPhaseMetricStrip({
  label,
  value,
  valueUnit,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** Shown inline next to the value in a smaller type (e.g. מ״ר, ק״ג). */
  valueUnit?: string;
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
        className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0 leading-none"
        dir={valueUnit ? "rtl" : undefined}
      >
        <span
          className="font-semibold tabular-nums text-[#6A23F7] text-[clamp(2rem,6.5vmin,4.25rem)]"
        >
          {value}
        </span>
        {valueUnit ? (
          <span className="text-base font-semibold tabular-nums text-muted-foreground sm:text-lg">
            {valueUnit}
          </span>
        ) : null}
      </p>
      <p className="text-[22px] font-semibold leading-snug text-muted-foreground pt-1 max-w-[18rem]">
        {label}
      </p>
    </div>
  );
}
