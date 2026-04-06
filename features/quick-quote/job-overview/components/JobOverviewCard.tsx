"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface JobOverviewCardProps {
  title: string;
  value: ReactNode;
  subtext: string;
  /** Stronger visual weight (e.g. total weight). */
  emphasized?: boolean;
}

export function JobOverviewCard({
  title,
  value,
  subtext,
  emphasized = false,
}: JobOverviewCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border-0 bg-card px-5 py-5 flex flex-col justify-between min-h-[132px]",
        emphasized ? "bg-primary/5 shadow-sm" : "shadow-sm"
      )}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <div
          className={cn(
            "mt-2 font-semibold tabular-nums tracking-tight text-foreground",
            emphasized ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
          )}
        >
          {value}
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-snug mt-3">{subtext}</p>
    </div>
  );
}
