"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runAutoNesting } from "@/lib/nesting/runAutoNesting";
import { saveNestingRun } from "@/lib/store";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import type { Batch } from "@/types";

function polygonNestingFromEnv(): boolean {
  const v = process.env.NEXT_PUBLIC_PLATE_POLYGON_NESTING?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function GenerateNestingPanel({ batch }: { batch: Batch }) {
  const router = useRouter();
  const { preferences } = useAppPreferences();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setBusy(true);
    try {
      const usePolygonNesting = polygonNestingFromEnv();
      const runResult = await runAutoNesting({
        batchId: batch.id,
        unitSystem: preferences.unitSystem,
        nestDurationMs: usePolygonNesting ? 28_000 : 8_000,
        usePolygonNesting,
      });
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
          Packs parts by thickness onto your stock using{" "}
          <strong>fast rectangle (shelf) nesting</strong> on each part’s outline — reliable and
          runs in seconds. Experimental polygon (SVGNest) mode is off unless{" "}
          <code className="text-[11px] bg-muted px-1 rounded">
            NEXT_PUBLIC_PLATE_POLYGON_NESTING=1
          </code>{" "}
          is set in <code className="text-[11px] bg-muted px-1 rounded">.env.local</code>.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={run} disabled={busy}>
          {busy ? "Nesting… (please wait)" : "Generate nesting"}
        </Button>
        {err ? (
          <p className="text-sm text-destructive">{err}</p>
        ) : null}
      </div>
    </div>
  );
}
