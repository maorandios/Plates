"use client";

/** One row in a method-phase sidebar — large value typography (matches manual / excel import split layout). */
export function MethodPhaseMetricStrip({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-5 py-5 sm:px-7 sm:py-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className="font-semibold tabular-nums tracking-tight text-foreground leading-none
          text-[clamp(2rem,6.5vmin,4.25rem)]"
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground leading-snug pt-1 max-w-[18rem]">{sub}</p>
    </div>
  );
}
