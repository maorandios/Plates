"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runServerNesting } from "@/lib/nesting/runServerNesting";
import { saveNestingRun } from "@/lib/store";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import type { Batch } from "@/types";

/**
 * Hard stop so the button cannot spin forever if the server job hangs.
 * One sheet can use a large budget; many sheets multiply wall time.
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
      const runPromise = runServerNesting({
        batch,
        unitSystem: preferences.unitSystem,
        nestingRunMode: "quick",
      });

      const runResult = await Promise.race([
        runPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Nesting stopped after ${NESTING_TOTAL_TIMEOUT_MS / 60_000} minutes to avoid a frozen tab. Try fewer parts or refresh the page if the app feels stuck. In dev, save files only after nesting finishes — hot reload can break a run mid-job.`
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
          Uses multi-pass ordering, anchor/score candidates, and compaction on the server. Large jobs
          can take <strong>over a minute</strong>; the timer shows elapsed time while the job runs.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => run()} disabled={busy}>
          {busy ? "Nesting…" : "Generate nesting"}
        </Button>
        {busy ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {elapsedSec}s · server job running…
          </span>
        ) : null}
        {err ? (
          <p className="text-sm text-destructive max-w-lg">{err}</p>
        ) : null}
      </div>
    </div>
  );
}
