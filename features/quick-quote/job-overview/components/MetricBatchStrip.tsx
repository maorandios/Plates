"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MetricStripItem {
  title: string;
  value: ReactNode;
  subtext: string;
}

interface MetricBatchStripProps {
  sectionTitle: string;
  items: MetricStripItem[];
}

/**
 * One bordered frame: title stripe (slightly lighter) + grid, shared outer border.
 */
export function MetricBatchStrip({ sectionTitle, items }: MetricBatchStripProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <h3 className="border-b border-border bg-white/[0.06] px-4 py-3 text-start text-sm font-semibold leading-snug text-foreground dark:bg-white/[0.07]">
        {sectionTitle}
      </h3>
      <div className="bg-card/25">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {items.map((item, i) => (
            <div
              key={`${item.title}-${i}`}
              className={cn(
                "flex min-h-[128px] flex-col items-center justify-center gap-2 px-3 py-7 text-center sm:px-5",
                i > 0 && "border-s border-border",
                (i === 2 || i === 3) && "border-t border-border md:border-t-0"
              )}
            >
              <p className="max-w-[18rem] text-[11px] font-semibold leading-snug tracking-wide text-muted-foreground">
                {item.title}
              </p>
              <div className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                {item.value}
              </div>
              <p className="max-w-[20rem] text-xs leading-snug text-muted-foreground">
                {item.subtext}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
