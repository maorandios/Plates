"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface JobOverviewCardProps {
  title: string;
  value: ReactNode;
  subtext?: string;
  /** Analysis row: light cards (ניצול = mint, גריעה = pink) — colors in globals.css */
  highlight?: "emerald" | "rose";
}

export function JobOverviewCard({
  title,
  value,
  subtext,
  highlight,
}: JobOverviewCardProps) {
  const isNeon = Boolean(highlight);

  return (
    <div
      className={cn(
        "rounded-xl border-2 px-4 py-5 flex min-h-[140px] flex-col items-center justify-center text-center shadow-sm",
        highlight === "emerald" && "job-overview-analysis-card--emerald",
        highlight === "rose" && "job-overview-analysis-card--rose",
        !highlight && "border-0 bg-card"
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 text-center",
          isNeon ? "text-current" : ""
        )}
      >
        <p
          className={cn(
            "max-w-[20rem] text-[11px] font-semibold leading-snug tracking-wide",
            isNeon ? "text-current" : "text-muted-foreground"
          )}
        >
          {title}
        </p>
        <div
          className={cn(
            "font-semibold tabular-nums tracking-tight",
            isNeon
              ? "text-3xl sm:text-4xl text-current"
              : "text-2xl sm:text-3xl text-foreground"
          )}
        >
          {value}
        </div>
        {subtext ? (
          <p
            className={cn(
              "max-w-[22rem] text-xs leading-snug",
              isNeon ? "text-current" : "text-muted-foreground"
            )}
          >
            {subtext}
          </p>
        ) : null}
      </div>
    </div>
  );
}
