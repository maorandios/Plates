"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
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
  /** Summary step (3): explicit save to projects list (same idea as quick-quote save to list). */
  saveProjectToList?: {
    label: string;
    savedLabel: string;
    /** User already saved this session to the list. */
    saved: boolean;
    /** False e.g. when there are no parts — button disabled but not in “saved” state. */
    canSave: boolean;
    onClick: () => void;
  };
}

export function PlateProjectBottomBar({
  currentStep,
  showBack,
  showContinue,
  canContinue,
  onBack,
  onContinue,
  saveProjectToList,
}: PlateProjectBottomBarProps) {
  const showBackBtn = showBack && currentStep > 1 && onBack;
  const showContinueBtn = showContinue && currentStep < MAX_STEP && onContinue;
  const showSaveToListBtn = Boolean(saveProjectToList);

  if (!showBackBtn && !showContinueBtn && !showSaveToListBtn) {
    return null;
  }

  return (
    <div className="sticky bottom-0 z-30 w-full shrink-0 border-t border-border bg-background/95 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
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
          {saveProjectToList && (
            <Button
              type="button"
              size="default"
              variant={saveProjectToList.saved ? "outline" : "default"}
              className="min-w-[10rem] gap-1"
              disabled={saveProjectToList.saved || !saveProjectToList.canSave}
              onClick={saveProjectToList.onClick}
            >
              {saveProjectToList.saved ? (
                <>
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                  {saveProjectToList.savedLabel}
                </>
              ) : (
                saveProjectToList.label
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
