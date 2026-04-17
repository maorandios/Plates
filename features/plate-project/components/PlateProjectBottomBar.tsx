"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { PlateProjectStep } from "../types/plateProject";

const MAX_STEP = 3 as const;

export interface PlateProjectBottomBarProps {
  currentStep: PlateProjectStep;
  showBack: boolean;
  showContinue: boolean;
  canContinue: boolean;
  onBack?: () => void;
  onContinue?: () => void;
}

export function PlateProjectBottomBar({
  currentStep,
  showBack,
  showContinue,
  canContinue,
  onBack,
  onContinue,
}: PlateProjectBottomBarProps) {
  const showBackBtn = showBack && currentStep > 1 && onBack;
  const showContinueBtn = showContinue && currentStep < MAX_STEP && onContinue;

  if (!showBackBtn && !showContinueBtn) {
    return null;
  }

  return (
    <div className="sticky bottom-0 z-30 w-full shrink-0 border-t border-white/[0.08] bg-background/95 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex w-full max-w-none items-center justify-start rtl:justify-end gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {showBackBtn && (
            <Button
              type="button"
              variant="outline"
              size="default"
              className="min-w-[7.5rem] gap-1"
              onClick={onBack}
            >
              <ChevronRight className="h-4 w-4" />
              {t("common.back")}
            </Button>
          )}
          {showContinueBtn && (
            <Button
              type="button"
              size="default"
              className="min-w-[7.5rem] gap-1"
              disabled={!canContinue}
              onClick={onContinue}
            >
              {t("common.continue")}
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
