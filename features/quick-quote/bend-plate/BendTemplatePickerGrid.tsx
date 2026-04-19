"use client";

import { formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { BendPlateQuoteItem, BendTemplateId } from "./types";
import { BendTemplatePickerGlyph } from "./BendTemplateShapeGlyph";

const BP_TEMPLATE = "quote.bendPlatePhase.template";

function templateTitle(id: BendTemplateId): string {
  return t(`${BP_TEMPLATE}.${id}.name`);
}

function templatePlateCount(id: BendTemplateId, items: BendPlateQuoteItem[]): number {
  return items
    .filter((x) => x.template === id)
    .reduce((acc, it) => acc + Math.max(0, Math.floor(it.global.quantity) || 0), 0);
}

/**
 * Fixed 4×2 layout (LTR columns so col 1 = visual left, col 4 = visual right).
 * Col 1: מדרגה / מותאם אישית · Col 2: תעלה / מרזב · Col 3: זוית / אומגה · Col 4: ריבוע rowspan 2.
 */
const TEMPLATE_GRID: { id: BendTemplateId; gridClass: string }[] = [
  { id: "z", gridClass: "col-start-1 row-start-1" },
  { id: "custom", gridClass: "col-start-1 row-start-2" },
  { id: "u", gridClass: "col-start-2 row-start-1" },
  { id: "gutter", gridClass: "col-start-2 row-start-2" },
  { id: "l", gridClass: "col-start-3 row-start-1" },
  { id: "omega", gridClass: "col-start-3 row-start-2" },
  { id: "plate", gridClass: "col-start-4 row-start-1 row-span-2" },
];

export interface BendTemplatePickerGridProps {
  quoteItems: BendPlateQuoteItem[];
  onSelectTemplate: (template: BendTemplateId) => void;
  /** Extra classes on the grid container (e.g. min-height). */
  className?: string;
}

/**
 * Template card grid shared by plate-project drawing picker and bend-plate quote hub (inline, no modal).
 */
export function BendTemplatePickerGrid({
  quoteItems,
  onSelectTemplate,
  className,
}: BendTemplatePickerGridProps) {
  return (
    <div
      dir="ltr"
      className={cn(
        "mx-auto grid min-h-[min(100%,28rem)] w-full min-w-[44rem] flex-1 gap-4",
        "grid-cols-4 grid-rows-2 [grid-template-rows:minmax(12rem,1fr)_minmax(12rem,1fr)]",
        className
      )}
    >
      {TEMPLATE_GRID.map(({ id, gridClass }) => {
        const title = templateTitle(id);
        const plateCount = templatePlateCount(id, quoteItems);
        const hasData = plateCount > 0;
        const isTall = id === "plate";
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectTemplate(id)}
            aria-label={
              plateCount > 0
                ? `${title} — ${t("plateProject.drawingPhase.templateCountAria", { n: plateCount })}`
                : title
            }
            className={cn(
              gridClass,
              "relative group flex min-h-0 min-w-0 flex-col items-center justify-center rounded-xl border bg-card p-5 text-center transition-[box-shadow,background-color,border-color] duration-150",
              isTall ? "h-full min-h-[14rem]" : "min-h-[12rem]",
              "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              /* Selection: one inset stroke only — avoids double borders + outer ring fighting rounded corners */
              hasData &&
                "border-white/[0.12] shadow-[0_0_32px_-14px_hsl(var(--primary)/0.5)] ring-2 ring-inset ring-primary hover:ring-primary",
              !hasData &&
                "border-white/[0.08] hover:border-primary/35 hover:bg-card/90 hover:shadow-[0_0_24px_-16px_hsl(var(--primary)/0.25)]"
            )}
          >
            {plateCount > 0 ? (
              <span
                className="absolute right-3 top-3 flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary px-2 text-xs font-bold tabular-nums text-primary-foreground shadow-md"
                aria-hidden
              >
                {formatInteger(plateCount)}
              </span>
            ) : null}
            <div
              className={cn(
                "mb-4 flex shrink-0 items-center justify-center rounded-xl transition-colors",
                isTall ? "h-14 w-14" : "h-11 w-11",
                hasData
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground group-hover:bg-muted/90"
              )}
            >
              <BendTemplatePickerGlyph
                id={id}
                className={cn("shrink-0", isTall ? "h-8 w-[3.25rem]" : "h-6 w-[2.75rem]")}
              />
            </div>
            <div
              className={cn(
                "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5",
                hasData
                  ? "border-primary/30 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "border-white/[0.12] bg-muted/35"
              )}
              dir="rtl"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  hasData
                    ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.65)]"
                    : "bg-muted-foreground/50"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "text-sm font-semibold leading-snug",
                  hasData ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {title}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
