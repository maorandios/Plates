"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveCuttingProfileRangesForMethod } from "@/lib/settings/cuttingProfiles";
import type { UnitSystem } from "@/types/settings";
import type { CuttingMethod, CuttingProfileRange } from "@/types/production";
import { CUTTING_METHOD_LABELS } from "@/types/production";
import { CuttingProfileRangeTable } from "./CuttingProfileRangeTable";
import { CuttingProfileRangeForm } from "./CuttingProfileRangeForm";

const METHOD_DESC: Record<CuttingMethod, string> = {
  laser: "Used for high-precision cutting jobs. Define how thin vs thick sheet should nest by default.",
  plasma: "Used for general-purpose plate cutting. Adjust spacing and margins by thickness band.",
  oxy_fuel:
    "Used for thicker plates and larger cut tolerances. Wider defaults are typical.",
};

interface CuttingMethodProfileSectionProps {
  method: CuttingMethod;
  ranges: CuttingProfileRange[];
  unitSystem: UnitSystem;
  onRangesChange: () => void;
}

export function CuttingMethodProfileSection({
  method,
  ranges,
  unitSystem,
  onRangesChange,
}: CuttingMethodProfileSectionProps) {
  const sorted = [...ranges].sort((a, b) => a.sortOrder - b.sortOrder);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CuttingProfileRange | null>(null);

  function persist(next: CuttingProfileRange[]) {
    const reindexed = next
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r, i) => ({ ...r, sortOrder: i }));
    saveCuttingProfileRangesForMethod(method, reindexed);
    onRangesChange();
  }

  function handleMoveUp(r: CuttingProfileRange) {
    const idx = sorted.findIndex((x) => x.id === r.id);
    if (idx <= 0) return;
    const next = [...sorted];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    persist(next);
  }

  function handleMoveDown(r: CuttingProfileRange) {
    const idx = sorted.findIndex((x) => x.id === r.id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const next = [...sorted];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    persist(next);
  }

  function handleDelete(r: CuttingProfileRange) {
    if (!window.confirm("Delete this thickness range rule?")) return;
    persist(sorted.filter((x) => x.id !== r.id));
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(r: CuttingProfileRange) {
    setEditing(r);
    setFormOpen(true);
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            {CUTTING_METHOD_LABELS[method]}
          </h3>
          <p className="text-sm text-muted-foreground leading-snug">{METHOD_DESC[method]}</p>
        </div>
        <CuttingProfileRangeTable
          ranges={sorted}
          unitSystem={unitSystem}
          onEdit={openEdit}
          onDelete={handleDelete}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
        <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add thickness range
        </Button>
      </div>

      <CuttingProfileRangeForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        method={method}
        unitSystem={unitSystem}
        initial={editing}
        siblingRanges={sorted}
        onSaved={(proposed) => {
          persist(proposed);
        }}
      />
    </>
  );
}
