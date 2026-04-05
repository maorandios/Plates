"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuickQuoteStep } from "../types/quickQuote";

const STEPS: { step: QuickQuoteStep; label: string }[] = [
  { step: 1, label: "General" },
  { step: 2, label: "Quote method" },
  { step: 3, label: "Parts" },
  { step: 4, label: "Stock & pricing" },
  { step: 5, label: "Calculation" },
  { step: 6, label: "Quote" },
  { step: 7, label: "Pricing" },
  { step: 8, label: "Finalize" },
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
    <div className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-background/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="px-4 py-4 sm:px-6 lg:px-8 flex items-center gap-4">
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
                        "text-xs font-medium text-center truncate w-full px-1 transition-colors duration-150",
                        isCurrent && "font-semibold text-foreground",
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
                        "h-0.5 flex-1 min-w-[12px] mx-1 rounded-full mb-6 transition-colors duration-150",
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
          {showContinue && currentStep < 8 && onContinue && (
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
