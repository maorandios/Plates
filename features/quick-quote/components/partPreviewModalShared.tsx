"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** DialogContent `className` shared by plate part preview modals (DXF / Excel / manual / merged summary). */
export const PART_PREVIEW_DIALOG_CONTENT_CLASS =
  "flex h-auto min-h-[min(88vh,760px)] max-h-[min(96vh,980px)] w-[calc(100vw-1.5rem)] max-w-[27.5rem] flex-col gap-0 overflow-hidden border-white/10 bg-card p-0 sm:max-w-[30rem] sm:rounded-xl";

export function StatValueUnitLeft({
  numericText,
  unitSuffix,
}: {
  numericText: string;
  unitSuffix: string;
}) {
  return (
    <span
      className="inline-flex flex-row items-baseline justify-center gap-1.5"
      dir="ltr"
    >
      <span className="text-sm text-muted-foreground">{unitSuffix.trim()}</span>
      <span className="text-base tabular-nums font-semibold text-foreground">{numericText}</span>
    </span>
  );
}

export function PreviewStatCell({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-square min-h-0 w-full min-w-0 flex-col items-center justify-center gap-1 overflow-hidden px-2 py-2.5 text-center",
        className
      )}
    >
      <Icon
        className="h-4 w-4 shrink-0 text-[#6A23F7]/70"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <span className="line-clamp-2 max-w-full break-words text-sm font-semibold leading-tight text-foreground sm:text-[15px]">
        {value}
      </span>
    </div>
  );
}
