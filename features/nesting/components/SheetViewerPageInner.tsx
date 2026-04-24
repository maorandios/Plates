"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { getBatchById } from "@/lib/store";
import {
  findSheetInBatchRuns,
  findSheetInRun,
  resolveNestingRunForBatch,
} from "@/lib/nesting/nestingResultsUtils";
import type { GeneratedSheet, NestingRun } from "@/types";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { SheetViewer } from "./SheetViewer";

function useBatchIdParam(): string {
  const params = useParams();
  const raw = params?.id;
  return typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
}

function useSheetIdParam(): string {
  const params = useParams();
  const raw = params?.sheetId;
  return typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
}

export function SheetViewerPageInner() {
  const batchId = useBatchIdParam();
  const sheetId = useSheetIdParam();
  const searchParams = useSearchParams();
  const runIdParam = searchParams.get("run");
  const { unitSystem } = useAppPreferences();

  const [resolved, setResolved] = useState<{
    run: NestingRun;
    sheet: GeneratedSheet;
  } | null>(null);
  const [missing, setMissing] = useState(false);

  const batch = useMemo(
    () => (batchId ? getBatchById(batchId) : undefined),
    [batchId]
  );

  useEffect(() => {
    if (!batchId || !sheetId) return;
    const run = resolveNestingRunForBatch(batchId, runIdParam);
    if (run) {
      const sheet = findSheetInRun(run, sheetId);
      if (sheet) {
        setResolved({ run, sheet });
        setMissing(false);
        return;
      }
    }
    const found = findSheetInBatchRuns(batchId, sheetId);
    if (found) {
      setResolved(found);
      setMissing(false);
    } else {
      setResolved(null);
      setMissing(true);
    }
  }, [batchId, sheetId, runIdParam]);

  if (!batchId || !sheetId) return null;

  if (!batch) {
    return (
      <PageContainer embedded>
        <p className="text-sm text-muted-foreground">Batch not found.</p>
      </PageContainer>
    );
  }

  if (missing || !resolved) {
    return (
      <PageContainer embedded>
        <div className="max-w-lg mx-auto py-12 space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Sheet not found, or it belongs to another nesting run.
          </p>
          <Button asChild variant="outline">
            <Link href={`/batches/${batchId}/nesting-results`}>
              Back to nesting results
            </Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer embedded>
      <SheetViewer
        batchId={batchId}
        run={resolved.run}
        sheet={resolved.sheet}
        unitSystem={unitSystem}
      />
    </PageContainer>
  );
}
