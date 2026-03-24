"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runAutoNesting } from "@/lib/nesting/runAutoNesting";
import { saveNestingRun } from "@/lib/store";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import type { Batch } from "@/types";

/**
 * Hard stop so the button cannot spin forever if SVGNest/worker hangs.
 * One sheet can use the full `nestDurationMs` budget; many sheets and stock sizes multiply
 * wall time — keep this above plausible multi-sheet runs.
 */
const NESTING_TOTAL_TIMEOUT_MS = 900_000;

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function GenerateNestingPanel({ batch }: { batch: Batch }) {
  const router = useRouter();
  const { preferences } = useAppPreferences();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!busy) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      setElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    tickRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [busy]);

  async function run() {
    setErr(null);
    setBusy(true);
    await waitForPaint();

    try {
      const runPromise = runAutoNesting({
        batchId: batch.id,
        unitSystem: preferences.unitSystem,
        nestDurationMs: 24_000,
        usePolygonNesting: true,
      });

      const runResult = await Promise.race([
        runPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Nesting stopped after ${NESTING_TOTAL_TIMEOUT_MS / 60_000} minutes to avoid a frozen tab. SVGNest runs once per filled sheet; large batches or many sheets multiply wait time. Try fewer parts, then generate again, or refresh the page if the app feels stuck. In dev, save files only after nesting finishes — hot reload can break SVGNest mid-run.`
                )
              ),
            NESTING_TOTAL_TIMEOUT_MS
          )
        ),
      ]);

      const saved = saveNestingRun(runResult);
      if (!saved) {
        setErr(
          "Could not save nesting results. Your browser storage may be full or blocked. Try clearing site data for this app or reducing the number of parts, then generate again."
        );
        return;
      }
      router.push(
        `/batches/${batch.id}/nesting-results?run=${encodeURIComponent(runResult.id)}`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nesting failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Automatic nesting</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
          Packs parts by thickness using <strong>SVGNest</strong> on real outer contours (with
          spacing offset in the SVG). If the nesting worker cannot load or places nothing, the app
          falls back to polygon-aware shelf packing. Large jobs can take{" "}
          <strong>over a minute per sheet</strong>; the timer below shows progress. Check{" "}
          <code className="text-[11px] bg-muted px-1 rounded">engineDebug</code> on results for
          footprint stats.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={run} disabled={busy}>
          {busy ? "Nesting…" : "Generate nesting"}
        </Button>
        {busy ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {elapsedSec}s elapsed — SVGNest is CPU-heavy; the page may feel slow until it finishes.
          </span>
        ) : null}
        {err ? (
          <p className="text-sm text-destructive max-w-lg">{err}</p>
        ) : null}
      </div>
    </div>
  );
}
