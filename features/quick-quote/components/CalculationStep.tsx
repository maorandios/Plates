"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CalcSubStep, QuickQuoteJobDetails, ValidationSummary } from "../types/quickQuote";

const STEP_LABELS = [
  "Reading Excel job data",
  "Matching parts to DXF records",
  "Checking plate metrics",
  "Estimating material usage",
  "Calculating cutting parameters",
  "Building quote summary",
];

interface CalculationStepProps {
  runId: number;
  jobDetails: QuickQuoteJobDetails;
  dxfFileCount: number;
  /** Distinct part / plate rows included in this calculation run */
  uniquePlatesInRun: number;
  totalPartsQty: number;
  validationSummary: ValidationSummary;
  onBack: () => void;
  onViewQuote: () => void;
}

export function CalculationStep({
  runId,
  jobDetails,
  dxfFileCount,
  uniquePlatesInRun,
  totalPartsQty,
  validationSummary,
  onBack,
  onViewQuote,
}: CalculationStepProps) {
  /** 0 = first step active; STEP_LABELS.length = all complete */
  const [completedThrough, setCompletedThrough] = useState(0);

  useEffect(() => {
    const delays = [450, 1100, 1750, 2400, 3050, 3800];
    const timers = delays.map((ms, idx) =>
      window.setTimeout(() => setCompletedThrough(idx + 1), ms)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [runId]);

  const steps: CalcSubStep[] = useMemo(
    () =>
      STEP_LABELS.map((label, i) => {
        let state: CalcSubStep["state"] = "pending";
        if (i < completedThrough) state = "complete";
        else if (i === completedThrough && completedThrough < STEP_LABELS.length)
          state = "active";
        return { id: `c${i}`, label, state };
      }),
    [completedThrough]
  );

  const allComplete = completedThrough >= STEP_LABELS.length;
  const progressPct = allComplete
    ? 100
    : Math.round((completedThrough / STEP_LABELS.length) * 100);

  const currentTask =
    steps.find((s) => s.state === "active")?.label ??
    (allComplete ? "Complete" : STEP_LABELS[0]);

  return (
    <div className="space-y-8">
      <div className="w-full">
        <h1 className="text-2xl font-semibold tracking-tight">Calculating quote</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          This step prepares the quote data based on uploaded files and validated part
          information. Values are mocked for UI preview.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px] xl:items-start">
        <Card className="border-white/[0.06] shadow-sm">
          <CardHeader className="border-b border-white/[0.08] bg-card/40">
            <CardTitle className="text-base">Progress</CardTitle>
            <CardDescription>
              Current task: <span className="text-foreground font-medium">{currentTask}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Overall</span>
                <span className="tabular-nums font-medium text-foreground">
                  {progressPct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <ul className="space-y-2 pt-2">
              {steps.map((s) => (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm",
                    s.state === "active" && "border-primary/40 bg-primary/5",
                    s.state === "complete" && "border-emerald-600/25 bg-emerald-600/[0.04]",
                    s.state === "pending" && "border-white/[0.08] bg-white/[0.03] text-muted-foreground"
                  )}
                >
                  <span className="mt-0.5 shrink-0">
                    {s.state === "complete" && (
                      <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
                    )}
                    {s.state === "active" && (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    )}
                    {s.state === "pending" && (
                      <Circle className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </span>
                  <span
                    className={cn(
                      s.state === "active" && "font-medium text-foreground",
                      s.state === "complete" && "text-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] shadow-sm xl:sticky xl:top-4">
          <CardHeader className="border-b border-white/[0.08] bg-card/40 pb-3">
            <CardTitle className="text-sm">Quote snapshot</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Quote reference</p>
              <p className="font-medium truncate font-mono text-xs">
                {jobDetails.referenceNumber || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium truncate">
                {jobDetails.customerName || "—"}
              </p>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">DXF files</span>
              <span className="font-medium tabular-nums">{dxfFileCount}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Plates in run</span>
              <span className="font-medium tabular-nums">{uniquePlatesInRun}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Total parts (qty)</span>
              <span className="font-medium tabular-nums">{totalPartsQty}</span>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
              Selection: {validationSummary.matched} matched ·{" "}
              {validationSummary.warnings} warnings · {validationSummary.critical}{" "}
              critical ({validationSummary.totalRows} rows)
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-white/[0.08]">
        <Button type="button" variant="outline" onClick={onBack}>
          Back to stock & pricing
        </Button>
        <Button type="button" size="lg" disabled={!allComplete} onClick={onViewQuote}>
          View quote
        </Button>
      </div>
    </div>
  );
}
