"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** True only in the browser — avoids SSR/hydration issues with `document`. */
function useIsBrowser(): boolean {
  return useSyncExternalStore(
    () => () => {
      /* no subscription */
    },
    () => true,
    () => false
  );
}

/**
 * Pill-shaped loading hint: bottom-center, Hebrew copy, orange status dot,
 * staggered three-dot animation. Scaled 1.25× vs base.
 *
 * Always portals to `document.body` so it is never clipped by `overflow` on
 * the app shell. Only mounts the portal after the browser snapshot is active.
 */
export function BottomLoadingIndicator({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  const isBrowser = useIsBrowser();

  if (!open || !isBrowser) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2",
        "origin-bottom scale-[1.25] transform",
        /* Above app chrome, dev overlays use high z — stay on top */
        "z-[2147483000]",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-full border border-border/90",
          "bg-card px-4 py-2.5 text-foreground shadow-xl",
          "backdrop-blur-md supports-[backdrop-filter]:bg-card/95"
        )}
        dir="rtl"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500 shadow-sm ring-1 ring-orange-600/25"
          aria-hidden
        />
        <span className="text-sm font-medium leading-none tracking-tight">
          {t("common.loadingData")}
        </span>
        <span className="flex items-center gap-1 ps-0.5" aria-hidden>
          <span className="plate-loading-dot" />
          <span className="plate-loading-dot" />
          <span className="plate-loading-dot" />
        </span>
      </div>
    </div>,
    document.body
  );
}
