"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { QuickQuoteStep } from "../types/quickQuote";

const STEP_KEYS = [
  "quote.steps.general",
  "quote.steps.quoteMethod",
  "quote.steps.parts",
  "quote.steps.stockPricing",
  "quote.steps.quantityAnalysis",
  "quote.steps.pricing",
  "quote.steps.finalize",
] as const;

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
    <div className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-background/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex w-full min-w-0 items-center justify-between gap-2 overflow-x-auto">
          {STEP_KEYS.map((labelKey, index) => {
            const step = (index + 1) as QuickQuoteStep;
            const label = t(labelKey);
            const isComplete = step < currentStep;
            const isCurrent = step === currentStep;
            const isReachable = step <= highestStepReached;
            const clickable = isReachable && step !== currentStep;

            return (
              <div key={step} className="flex min-w-0 flex-1 items-center last:flex-none">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onStepSelect(step)}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-2 group",
                    clickable && "cursor-pointer",
                    !clickable && "cursor-default"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums transition-all duration-150",
                      isComplete &&
                        "border-primary/70 bg-primary/15 text-primary",
                      isCurrent &&
                        !isComplete &&
                        "border-primary bg-primary text-primary-foreground shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]",
                      !isCurrent &&
                        !isComplete &&
                        (isReachable
                          ? "border-white/15 bg-card text-muted-foreground"
                          : "border-white/[0.06] bg-muted/40 text-muted-foreground/45")
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
                      "w-full truncate px-1 text-center text-xs font-medium transition-colors duration-150",
                      isCurrent && "font-semibold text-foreground",
                      !isCurrent && isReachable && "text-muted-foreground",
                      !isReachable && "text-muted-foreground/40"
                    )}
                  >
                    {label}
                  </span>
                </button>
                {index < STEP_KEYS.length - 1 && (
                  <div
                    className={cn(
                      "mx-1 mb-6 h-0.5 min-w-[12px] flex-1 rounded-full transition-colors duration-150",
                      step < currentStep ? "bg-primary/45" : "bg-white/[0.08]"
                    )}
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
