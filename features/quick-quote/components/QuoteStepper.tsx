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

const STEP_COUNT = STEP_KEYS.length;

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
  /** Fills from inline-start (right in RTL) toward the left as steps advance */
  const overallProgressPct = Math.min(
    100,
    Math.max(0, (currentStep / STEP_COUNT) * 100)
  );

  return (
    <div
      className={cn(
        "sticky top-0 z-40 w-full",
        "qq-glass border-b border-border/25 shadow-none"
      )}
    >
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        {/*
          Each step and connector in its own flex-1 column (same as PlateProjectStepper).
          Avoids justify-between + last:flex-none, which left uneven margins in RTL
          (wide gap on the inline-start / visual right vs narrow on the other side).
        */}
        <div className="flex w-full min-w-0 items-start gap-2 overflow-x-auto overflow-y-visible pb-1 pt-0.5 [scrollbar-width:thin]">
          {STEP_KEYS.map((labelKey, index) => {
            const step = (index + 1) as QuickQuoteStep;
            const label = t(labelKey);
            const isComplete = step < currentStep;
            const isCurrent = step === currentStep;
            const isReachable = step <= highestStepReached;
            const clickable = isReachable && step !== currentStep;

            return (
              <div key={step} className="contents">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && onStepSelect(step)}
                    className={cn(
                      "group flex max-w-full min-w-0 flex-col items-center gap-2",
                      clickable && "cursor-pointer",
                      !clickable && "cursor-default"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center overflow-visible rounded-full border-2 text-sm font-semibold tabular-nums leading-none transition-all duration-150",
                        isComplete &&
                          "border-primary/70 bg-primary/15 text-primary",
                        isCurrent &&
                          !isComplete &&
                          "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30",
                        !isCurrent &&
                          !isComplete &&
                          (isReachable
                            ? "border-border bg-card text-muted-foreground"
                            : "border-border/60 bg-muted/40 text-muted-foreground/45")
                      )}
                    >
                      {isComplete ? (
                        <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                      ) : (
                        <span className="flex size-full items-center justify-center px-0.5 pt-[1px] leading-none">
                          {step}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "w-full truncate px-1 text-center text-xs font-medium leading-snug transition-colors duration-150",
                        isCurrent && "font-semibold text-foreground",
                        !isCurrent && isReachable && "text-muted-foreground",
                        !isReachable && "text-muted-foreground/40"
                      )}
                    >
                      {label}
                    </span>
                  </button>
                </div>
                {index < STEP_KEYS.length - 1 && (
                  <div
                    className={cn(
                      "flex min-w-0 flex-1 shrink-0 items-start pt-5",
                      "min-w-[12px]"
                    )}
                    aria-hidden
                  >
                    <div
                      className={cn(
                        "h-0.5 w-full rounded-full transition-colors duration-150",
                        step < currentStep ? "bg-primary/45" : "bg-border/80"
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Thin purple progress — width grows with current step (RTL: expands toward the left) */}
      <div className="h-[3px] w-full bg-border/35">
        <div
          className="h-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${overallProgressPct}%` }}
        />
      </div>
    </div>
  );
}
