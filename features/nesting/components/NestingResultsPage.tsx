"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getBatchById,
  getNestingRunsByBatch,
  PLATE_NESTING_RUN_SAVED_EVENT,
} from "@/lib/store";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { resolveNestingRunForBatch } from "@/lib/nesting/nestingResultsUtils";
import type { NestingRun } from "@/types";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import {
  formatNestingEngineDescription,
  formatNestingEngineShort,
  formatNestingEngineTitle,
} from "@/lib/nesting/nestingEngineLabels";
import { ThicknessResultsSection } from "./ThicknessResultsSection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function useBatchIdParam(): string {
  const params = useParams();
  const raw = params?.id;
  return typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
}

export function NestingResultsPage() {
  const batchId = useBatchIdParam();
  const router = useRouter();
  const searchParams = useSearchParams();
  const runIdParam = searchParams.get("run");
  const querySignature = searchParams.toString();
  const { preferences, unitSystem } = useAppPreferences();

  const [run, setRun] = useState<NestingRun | null>(null);

  const batch = useMemo(
    () => (batchId ? getBatchById(batchId) : undefined),
    [batchId]
  );

  const runsForBatch = useMemo(
    () => (batchId ? getNestingRunsByBatch(batchId) : []),
    [batchId, querySignature]
  );

  useEffect(() => {
    if (!batchId) return;
    const sync = () => {
      const id = new URLSearchParams(querySignature).get("run") ?? runIdParam;
      setRun(resolveNestingRunForBatch(batchId, id));
    };
    sync();
    const raf = requestAnimationFrame(sync);
    const t = window.setTimeout(sync, 0);
    const onSaved = () => sync();
    window.addEventListener(PLATE_NESTING_RUN_SAVED_EVENT, onSaved);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.removeEventListener(PLATE_NESTING_RUN_SAVED_EVENT, onSaved);
    };
  }, [batchId, querySignature]);

  if (!batchId) return null;

  if (!batch) {
    return (
      <PageContainer embedded>
        <p className="text-sm text-muted-foreground">Batch not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/batches">Back</Link>
        </Button>
      </PageContainer>
    );
  }

  const unplacedRows = run
    ? run.thicknessResults.flatMap((tr) =>
        tr.unplacedParts.map((u) => ({
          ...u,
          thicknessLabel:
            tr.thicknessMm != null ? `${tr.thicknessMm} mm` : "—",
        }))
      )
    : [];

  return (
    <PageContainer embedded>
      <div className="max-w-5xl mx-auto space-y-10 pb-12">
        <header className="space-y-2 border-b border-border pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground tracking-tight">
                  Nesting results
                </h1>
                {run ? (
                  <Badge
                    variant={run.nestingEngine === "svgnest" ? "default" : "secondary"}
                    title={formatNestingEngineDescription(run.nestingEngine)}
                  >
                    {formatNestingEngineTitle(run.nestingEngine)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {batch.name} — verify layouts before export or adjustments.
              </p>
              {run ? (
                <p className="text-xs text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                  {formatNestingEngineDescription(run.nestingEngine)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/batches/${batchId}/stock`}>Stock</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/batches/${batchId}/parts`}>Parts</Link>
              </Button>
            </div>
          </div>

          {runsForBatch.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="nest-run-select" className="text-muted-foreground">
                Run:
              </label>
              <select
                id="nest-run-select"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={run?.id ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id)
                    router.push(
                      `/batches/${batchId}/nesting-results?run=${encodeURIComponent(id)}`
                    );
                }}
              >
                {runsForBatch
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {new Date(r.createdAt).toLocaleString()} ·{" "}
                      {formatNestingEngineShort(r.nestingEngine)} · {r.totalSheets} sheets ·{" "}
                      {r.placedPartCount} placed
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
        </header>

        {!run ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              No nesting run found for this batch yet.
            </p>
            <Button asChild>
              <Link href={`/batches/${batchId}/stock`}>
                Go to stock — Generate nesting
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard
                  title="Sheets used"
                  value={formatInteger(run.totalSheets)}
                />
                <StatCard
                  title="Placement engine"
                  value={formatNestingEngineShort(run.nestingEngine)}
                />
                <StatCard
                  title="Utilization"
                  value={`${formatDecimal(run.totalUtilizationPercent, 1)}%`}
                />
                <StatCard
                  title="Placed parts"
                  value={formatInteger(run.placedPartCount)}
                />
                <StatCard
                  title="Unplaced qty"
                  value={formatInteger(run.unplacedPartCount)}
                />
                <StatCard
                  title="Used area"
                  value={`${formatDecimal(run.usedAreaMm2 / 1_000_000, 3)} m²`}
                />
                <StatCard
                  title="Waste area"
                  value={`${formatDecimal(run.totalWasteAreaMm2 / 1_000_000, 3)} m²`}
                />
              </div>
              {run.errors.length > 0 ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <p className="font-medium mb-1">Errors</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {run.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {run.warnings.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-medium mb-1">Warnings</p>
                  <ul className="list-disc pl-4 space-y-1 max-h-32 overflow-y-auto text-xs">
                    {run.warnings.slice(0, 15).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {run.warnings.length > 15 ? (
                      <li>…and {run.warnings.length - 15} more</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                By thickness
              </h2>
              {run.thicknessResults.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  No thickness groups in this run (no nestable parts or nesting produced no
                  results). Check parts, DXF geometry, stock for each thickness, then generate
                  again from Stock.
                </div>
              ) : (
                <div className="space-y-4">
                  {run.thicknessResults.map((tr, i) => (
                    <ThicknessResultsSection
                      key={`${tr.thicknessMm ?? "none"}-${i}`}
                      batchId={batchId}
                      runId={run.id}
                      result={tr}
                      unitSystem={unitSystem}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Unplaced parts
              </h2>
              {unplacedRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All nestable instances were placed.
                </p>
              ) : (
                <div className="rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Part name</TableHead>
                        <TableHead>Client code</TableHead>
                        <TableHead>Thickness</TableHead>
                        <TableHead className="text-right">Qty unplaced</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unplacedRows.map((row, i) => (
                        <TableRow key={`${row.partId}-${i}`}>
                          <TableCell className="font-medium">
                            {row.partName}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.clientCode?.trim() || "—"}
                          </TableCell>
                          <TableCell>{row.thicknessLabel}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.quantityUnplaced}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-md">
                            {row.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <p className="text-xs text-muted-foreground">
              Run {run.id} · {formatNestingEngineShort(run.nestingEngine)} ·{" "}
              {new Date(run.createdAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </PageContainer>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
