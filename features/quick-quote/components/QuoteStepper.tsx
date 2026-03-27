"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuickQuoteStep } from "../types/quickQuote";

const STEPS: { step: QuickQuoteStep; label: string }[] = [
  { step: 1, label: "Upload" },
  { step: 2, label: "Validation" },
  { step: 3, label: "Stock & pricing" },
  { step: 4, label: "Calculation" },
  { step: 5, label: "Quote" },
  { step: 6, label: "Finalize" },
];

interface QuoteStepperProps {
  currentStep: QuickQuoteStep;
  highestStepReached: QuickQuoteStep;
  onStepSelect: (step: QuickQuoteStep) => void;
}

export function QuoteStepper({
  currentStep,
  highestStepReached,
  onStepSelect,
}: QuoteStepperProps) {
  return (
    <div className="w-full">
      <div className="flex w-full items-center justify-between gap-2">
        {STEPS.map(({ step, label }, index) => {
          const isComplete = step < currentStep;
          const isCurrent = step === currentStep;
          const isReachable = step <= highestStepReached;
          const clickable = isReachable && step !== currentStep;

          return (
            <div key={step} className="flex flex-1 items-center min-w-0 last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepSelect(step)}
                className={cn(
                  "flex flex-col items-center gap-2 min-w-0 flex-1 group",
                  clickable && "cursor-pointer",
                  !clickable && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums transition-colors",
                    isComplete &&
                      "border-emerald-600/80 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200",
                    isCurrent &&
                      !isComplete &&
                      "border-primary bg-primary text-primary-foreground shadow-sm",
                    !isCurrent &&
                      !isComplete &&
                      (isReachable
                        ? "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                        : "border-border bg-muted/30 text-muted-foreground/50")
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    step
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium text-center truncate w-full px-1",
                    isCurrent && "text-foreground",
                    !isCurrent && isReachable && "text-muted-foreground",
                    !isReachable && "text-muted-foreground/40"
                  )}
                >
                  {label}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 min-w-[12px] mx-1 rounded-full mb-6",
                    step < currentStep ? "bg-emerald-600/50" : "bg-border"
                  )}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
