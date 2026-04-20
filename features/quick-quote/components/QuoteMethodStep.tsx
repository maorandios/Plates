"use client";

import { FileCode2, FileSpreadsheet, FoldHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuoteCreationMethod } from "../types/quickQuote";

const OPTIONS: {
  id: QuoteCreationMethod;
  title: string;
  description: string;
  hint: string;
  Icon: typeof FileCode2;
}[] = [
  {
    id: "dxf",
    title: "DXF",
    description: "Upload DXF files for quoting",
    hint: "Best for ready CAD files",
    Icon: FileCode2,
  },
  {
    id: "excelImport",
    title: "Import Excel list",
    description: "Upload a spreadsheet and map columns",
    hint: "CSV or Excel — same mapping flow as DXF BOM",
    Icon: FileSpreadsheet,
  },
  {
    id: "bendPlate",
    title: "Bend plate",
    description: "Build a bent plate from a side profile or template",
    hint: "Geometry for quoting will be generated from your profile",
    Icon: FoldHorizontal,
  },
];

interface QuoteMethodStepProps {
  selected: QuoteCreationMethod | null;
  onSelect: (method: QuoteCreationMethod) => void;
}

export function QuoteMethodStep({ selected, onSelect }: QuoteMethodStepProps) {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      <header className="space-y-1 text-center sm:text-left">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Quote method</h1>
        <p className="text-sm text-muted-foreground">
          Choose how you want to build this quote. Use Continue when you are ready.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OPTIONS.map(({ id, title, description, hint, Icon }) => {
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                "flex flex-col rounded-xl border-2 bg-card p-6 text-left transition-all",
                "hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected
                  ? "border-primary shadow-md ring-1 ring-primary/20"
                  : "border-border"
              )}
            >
              <div
                className={cn(
                  "mb-4 flex h-12 w-12 items-center justify-center rounded-xl",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <span className="text-base font-semibold text-foreground">{title}</span>
              <span className="mt-2 text-sm text-muted-foreground leading-snug">{description}</span>
              <span className="mt-3 text-xs text-muted-foreground/90 leading-snug">{hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
