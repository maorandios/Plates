"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchStatusBadge } from "@/components/shared/StatusBadge";
import { getBatchById } from "@/lib/store";
import type { Batch } from "@/types";
import { cn } from "@/lib/utils";
import {
  BATCH_PROCESS_STEPS,
  batchStepHref,
  pathnameToStepIndex,
  type BatchProcessStepIndex,
} from "./batchProcessConfig";

const TOP_HEADER_PX = 56; /* h-14 */

interface BatchProcessShellProps {
  batchId: string;
  children: React.ReactNode;
}

export function BatchProcessShell({ batchId, children }: BatchProcessShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [batch, setBatch] = useState<Batch | null>(null);

  const stepIndex = useMemo(
    () => pathnameToStepIndex(batchId, pathname),
    [batchId, pathname]
  );

  useEffect(() => {
    setBatch(getBatchById(batchId) ?? null);
  }, [batchId, pathname]);

  const last = BATCH_PROCESS_STEPS.length - 1;
  const canBackProcess = stepIndex > 0;
  const canContinue = stepIndex < last;

  function goStep(i: BatchProcessStepIndex) {
    router.push(batchStepHref(batchId, i));
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full min-w-0">
      <div
        className="sticky z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 shadow-sm"
        style={{ top: TOP_HEADER_PX }}
      >
        <div className="px-4 lg:px-6 py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3 gap-y-2">
            <Button variant="ghost" size="sm" className="-ml-2 shrink-0" asChild>
              <Link href="/batches">
                <ArrowLeft className="h-4 w-4 mr-1" />
                All batches
              </Link>
            </Button>

            <nav
              className="flex flex-1 min-w-0 items-center gap-0 sm:gap-1 overflow-x-auto pb-1 sm:pb-0"
              aria-label="Batch workflow steps"
            >
              {BATCH_PROCESS_STEPS.map((step, i) => {
                const active = i === stepIndex;
                const done = i < stepIndex;
                return (
                  <div key={step.segment || "import"} className="flex items-center shrink-0">
                    {i > 0 && (
                      <div
                        className={cn(
                          "hidden sm:block w-6 lg:w-10 h-px mx-1 lg:mx-2 shrink-0",
                          done ? "bg-primary/50" : "bg-border"
                        )}
                        aria-hidden
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => goStep(i as BatchProcessStepIndex)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                        active
                          ? "bg-primary/10 ring-1 ring-primary/25"
                          : "hover:bg-muted/80"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                          active
                            ? "bg-primary text-primary-foreground"
                            : done
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium leading-tight max-w-[140px] sm:max-w-none",
                          active ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <span className="sm:hidden">{step.shortLabel}</span>
                        <span className="hidden sm:inline">{step.label}</span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              {canBackProcess ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    goStep((stepIndex - 1) as BatchProcessStepIndex)
                  }
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : null}
              {canContinue ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    goStep((stepIndex + 1) as BatchProcessStepIndex)
                  }
                  className="gap-1"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {batch && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t border-border/60 pt-2">
              <span className="font-semibold text-foreground text-sm">
                {batch.name}
              </span>
              {batch.notes ? (
                <span className="line-clamp-1 max-w-md">{batch.notes}</span>
              ) : null}
              <BatchStatusBadge status={batch.status} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
