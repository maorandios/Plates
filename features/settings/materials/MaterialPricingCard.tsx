"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import type { MaterialConfig } from "@/types/materials";
import { MATERIAL_TYPE_LABELS } from "@/types/materials";
import { cn } from "@/lib/utils";

const SK = "settings.materials" as const;

/**
 * Rounded-rectangle tag: full label visible (wrap if long, never ellipsis). Physical px for symmetric inset under RTL.
 */
const tagChipClass =
  "inline-flex w-fit max-w-full min-w-0 items-center gap-2 rounded-md border border-border/80 bg-muted/70 py-1.5 pl-3 pr-3 text-sm font-medium text-foreground/90 shadow-sm transition-colors hover:bg-muted/85 hover:border-border dark:bg-muted/55 dark:hover:bg-muted/70";

const tagChipTextClass =
  "min-w-0 max-w-full whitespace-normal break-words text-start leading-normal";

const tagChipInputClass =
  "min-w-0 max-w-[min(18rem,100%)] border-0 bg-transparent py-0 text-sm font-medium leading-normal text-foreground/90 shadow-none outline-none ring-0 focus-visible:ring-0";

interface MaterialPricingCardProps {
  config: MaterialConfig;
  onUpdate: (patch: Partial<MaterialConfig>) => void;
}

function TagEditorSection({
  titleId,
  title,
  values,
  removeAria,
  addButtonAria,
  onChange,
  valueDir = "auto",
}: {
  titleId: string;
  title: string;
  values: string[];
  removeAria: (value: string) => string;
  addButtonAria: string;
  onChange: (next: string[]) => void;
  valueDir?: "ltr" | "rtl" | "auto";
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function flushDraft() {
    const next = draft.trim();
    setDraft("");
    setAdding(false);
    if (!next || values.includes(next)) return;
    onChange([...values, next]);
  }

  function removeAt(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  return (
    <section
      className="rounded-lg border border-border/50 bg-card/30 p-4 shadow-sm"
      aria-labelledby={titleId}
    >
      <h3 id={titleId} className="text-start text-sm font-semibold text-foreground">
        {title}
      </h3>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {values.map((value) => (
          <span key={value} dir="ltr" className={tagChipClass}>
            <span dir={valueDir} className={tagChipTextClass}>
              {value}
            </span>
            <button
              type="button"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm p-0 text-muted-foreground/90 transition-colors hover:bg-background/75 hover:text-foreground"
              onClick={() => removeAt(value)}
              aria-label={removeAria(value)}
            >
              <X className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
            </button>
          </span>
        ))}

        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={addButtonAria}
            className={cn(
              "inline-flex w-fit max-w-full shrink-0 items-center gap-1.5 self-center rounded-md border border-dashed border-muted-foreground/35 bg-transparent py-1.5 pl-3 pr-3 text-sm font-medium text-muted-foreground transition-colors",
              "hover:border-muted-foreground/55 hover:bg-muted/35 hover:text-foreground"
            )}
          >
            <Plus className="size-3.5 shrink-0" aria-hidden />
            <span>{t(`${SK}.tagAddLabel`)}</span>
          </button>
        ) : (
          <span
            dir="ltr"
            className={cn(
              tagChipClass,
              "ring-offset-background focus-within:border-border focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            )}
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              dir="auto"
              aria-label={addButtonAria}
              size={Math.min(48, Math.max(10, draft.length + 2))}
              className={cn(tagChipInputClass, "text-start")}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  flushDraft();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setDraft("");
                  setAdding(false);
                }
              }}
              onBlur={() => {
                const trimmed = draft.trim();
                if (!trimmed) {
                  setDraft("");
                  setAdding(false);
                  return;
                }
                flushDraft();
              }}
            />
            <button
              type="button"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm p-0 text-muted-foreground/90 transition-colors hover:bg-background/75 hover:text-foreground"
              aria-label={t(`${SK}.cancel`)}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                setDraft("");
                setAdding(false);
              }}
            >
              <X className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
            </button>
          </span>
        )}
      </div>
    </section>
  );
}

export function MaterialPricingCard({ config, onUpdate }: MaterialPricingCardProps) {
  const [density, setDensity] = useState(config.densityKgPerM3.toString());

  useEffect(() => {
    setDensity(config.densityKgPerM3.toString());
  }, [config.densityKgPerM3]);

  const persist = useCallback(
    (patch: Partial<MaterialConfig>) => {
      onUpdate({ ...patch, pricingMode: "perKg" });
    },
    [onUpdate]
  );

  function handleDensityBlur() {
    const n = parseFloat(density);
    if (Number.isFinite(n) && n > 0) {
      persist({ densityKgPerM3: n });
    } else {
      setDensity(config.densityKgPerM3.toString());
    }
  }

  const materialLabel = MATERIAL_TYPE_LABELS[config.materialType];
  const gradeTitleId = `${config.materialType}-grades-heading`;
  const finishTitleId = `${config.materialType}-finishes-heading`;

  return (
    <Card className="shadow-none">
      <CardHeader className="text-start space-y-1.5">
        <CardTitle className="text-base">{t(`${SK}.basicsTitle`)}</CardTitle>
        <CardDescription className="leading-relaxed">
          {t(`${SK}.basicsDescription`, { material: materialLabel })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 text-start">
          <Label htmlFor={`${config.materialType}-density`} className="text-start">
            {t(`${SK}.density`)}
          </Label>
          <Input
            id={`${config.materialType}-density`}
            type="number"
            step="1"
            min="1"
            dir="ltr"
            className="text-end"
            value={density}
            onChange={(e) => setDensity(e.target.value)}
            onBlur={handleDensityBlur}
            placeholder="7850"
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">{t(`${SK}.densityHint`)}</p>
        </div>

        <div className="space-y-4">
          <TagEditorSection
            titleId={gradeTitleId}
            title={t(`${SK}.gradeSectionTitle`)}
            values={config.enabledGrades}
            removeAria={(v) => t(`${SK}.tagRemoveAria`, { value: v })}
            addButtonAria={t(`${SK}.gradeAddButtonAria`)}
            onChange={(enabledGrades) => persist({ enabledGrades })}
            valueDir="ltr"
          />
          <TagEditorSection
            titleId={finishTitleId}
            title={t(`${SK}.finishSectionTitle`)}
            values={config.enabledFinishes}
            removeAria={(v) => t(`${SK}.tagRemoveAria`, { value: v })}
            addButtonAria={t(`${SK}.finishAddButtonAria`)}
            onChange={(enabledFinishes) => persist({ enabledFinishes })}
            valueDir="auto"
          />
        </div>
      </CardContent>
    </Card>
  );
}
