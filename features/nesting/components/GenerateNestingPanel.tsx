"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Batch } from "@/types";

/**
 * Placeholder for automatic nesting. Server-side Python nesting was removed; saved runs
 * remain viewable from nesting results.
 */
export function GenerateNestingPanel({ batch }: { batch: Batch }) {
  return (
    <div className="rounded-xl bg-muted/20 px-4 py-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Automatic nesting</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
          Server-side nesting is not available in this build. Open{" "}
          <strong>Nesting results</strong> to view runs already saved for this batch (from
          earlier sessions or other tools).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" disabled>
          Generate nesting
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={`/batches/${batch.id}/nesting-results`}>View nesting results</Link>
        </Button>
      </div>
    </div>
  );
}
