"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuickQuoteStep } from "../types/quickQuote";

const STEPS: { step: QuickQuoteStep; label: string }[] = [
  { step: 1, label: "General" },
  { step: 2, label: "Quote method" },
  { step: 3, label: "Parts" },
  { step: 4, label: "Method setup" },
  { step: 5, label: "Upload Excel" },
  { step: 6, label: "Upload DXF" },
  { step: 7, label: "Analyze" },
  { step: 8, label: "Stock & pricing" },
  { step: 9, label: "Calculation" },
  { step: 10, label: "Quote" },
  { step: 11, label: "Finalize" },
];

interface QuoteStepperProps {
  currentStep: QuickQuoteStep;
  highestStepReached: QuickQuoteStep;
  onStepSelect: (step: QuickQuoteStep) => void;
  onBack?: () => void;
  onContinue?: () => void;
  canContinue?: boolean;
  showBack?: boolean;
  showContinue?: boolean;
}

export function QuoteStepper({
  currentStep,
  highestStepReached,
  onStepSelect,
  onBack,
  onContinue,
  canContinue = true,
  showBack = true,
  showContinue = true,
}: QuoteStepperProps) {
  return (
    <div className="sticky top-0 z-40 w-full border-b border-border bg-card shadow-sm">
      <div className="px-4 py-4 sm:px-6 flex items-center gap-4">
        <div className="flex-1 min-w-0 overflow-x-auto">
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
        <div className="flex items-center gap-2 shrink-0">
          {showBack && currentStep > 1 && onBack && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {showContinue && currentStep < 11 && onContinue && (
            <Button
              type="button"
              size="sm"
              onClick={onContinue}
              disabled={!canContinue}
              className="gap-1"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
