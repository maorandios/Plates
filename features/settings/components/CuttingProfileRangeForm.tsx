"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatLengthValueOnly,
  parseLengthInputToMm,
} from "@/lib/settings/unitSystem";
import { nanoid } from "@/lib/utils/nanoid";
import { validateCuttingProfileRangesForMethod } from "@/lib/settings/cuttingProfiles";
import type { UnitSystem } from "@/types/settings";
import type {
  CuttingMethod,
  CuttingProfileRange,
  ProfileRotationMode,
} from "@/types/production";
import { PROFILE_ROTATION_MODE_LABELS } from "@/types/production";

interface CuttingProfileRangeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: CuttingMethod;
  unitSystem: UnitSystem;
  /** Null = add new rule */
  initial: CuttingProfileRange | null;
  /** All rules for this method (used for overlap validation). */
  siblingRanges: CuttingProfileRange[];
  onSaved: (nextMethodRanges: CuttingProfileRange[]) => void;
}

function nextSortOrder(siblingRanges: CuttingProfileRange[]): number {
  if (siblingRanges.length === 0) return 0;
  return Math.max(...siblingRanges.map((r) => r.sortOrder)) + 1;
}

function emptyDraft(method: CuttingMethod, sortOrder: number): CuttingProfileRange {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    method,
    minThicknessMm: 0,
    maxThicknessMm: 10,
    defaultSpacingMm: 4,
    defaultEdgeMarginMm: 8,
    allowRotation: true,
    rotationMode: "ninetyOnly",
    defaultMarkPartName: true,
    defaultIncludeClientCode: false,
    sortOrder,
    updatedAt: now,
  };
}

export function CuttingProfileRangeForm({
  open,
  onOpenChange,
  method,
  unitSystem,
  initial,
  siblingRanges,
  onSaved,
}: CuttingProfileRangeFormProps) {
  const [draft, setDraft] = useState<CuttingProfileRange>(() =>
    initial ?? emptyDraft(method, siblingRanges.length)
  );
  const [minStr, setMinStr] = useState("");
  const [maxStr, setMaxStr] = useState("");
  const [noMax, setNoMax] = useState(false);
  const [spacingStr, setSpacingStr] = useState("");
  const [edgeStr, setEdgeStr] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const base =
      initial ?? emptyDraft(method, nextSortOrder(siblingRanges));
    setDraft(base);
    setMinStr(formatLengthValueOnly(base.minThicknessMm, unitSystem));
    setMaxStr(
      base.maxThicknessMm === null
        ? ""
        : formatLengthValueOnly(base.maxThicknessMm, unitSystem)
    );
    setNoMax(base.maxThicknessMm === null);
    setSpacingStr(formatLengthValueOnly(base.defaultSpacingMm, unitSystem));
    setEdgeStr(formatLengthValueOnly(base.defaultEdgeMarginMm, unitSystem));
    setFormErrors([]);
  }, [open, initial?.id, method, unitSystem, siblingRanges.length]);

  function handleSubmit() {
    const errors: string[] = [];
    const minMm = parseLengthInputToMm(minStr, unitSystem);
    if (minMm == null || minMm < 0 || !Number.isFinite(minMm)) {
      errors.push("Min thickness must be a number ≥ 0.");
    }
    let maxMm: number | null = null;
    if (!noMax) {
      const parsed = parseLengthInputToMm(maxStr, unitSystem);
      if (parsed == null || !Number.isFinite(parsed)) {
        errors.push("Enter a max thickness, or check “No upper limit”.");
      } else {
        maxMm = parsed;
        if (minMm != null && maxMm <= minMm) {
          errors.push("Max thickness must be greater than min thickness.");
        }
      }
    }
    const sp = parseLengthInputToMm(spacingStr, unitSystem);
    const ed = parseLengthInputToMm(edgeStr, unitSystem);
    if (sp == null || sp < 0 || !Number.isFinite(sp)) {
      errors.push("Spacing must be a number ≥ 0.");
    }
    if (ed == null || ed < 0 || !Number.isFinite(ed)) {
      errors.push("Edge margin must be a number ≥ 0.");
    }
    if (errors.length) {
      setFormErrors(errors);
      return;
    }

    const nextRow: CuttingProfileRange = {
      ...draft,
      method,
      minThicknessMm: minMm!,
      maxThicknessMm: noMax ? null : maxMm,
      defaultSpacingMm: sp!,
      defaultEdgeMarginMm: ed!,
      updatedAt: new Date().toISOString(),
    };

    const others = siblingRanges.filter((r) => r.id !== nextRow.id);
    const proposed = [...others, nextRow].sort((a, b) => a.sortOrder - b.sortOrder);

    const v = validateCuttingProfileRangesForMethod(proposed);
    if (!v.ok) {
      setFormErrors(v.errors);
      return;
    }

    onSaved(proposed);
    setFormErrors([]);
    onOpenChange(false);
  }

  const lenUnit = unitSystem === "metric" ? "mm" : "in";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit thickness range" : "Add thickness range"}
          </DialogTitle>
          <DialogDescription>
            Values use your global unit system ({unitSystem}) and are stored in millimeters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cp-min">Min thickness ({lenUnit})</Label>
              <Input
                id="cp-min"
                className="font-mono tabular-nums"
                value={minStr}
                onChange={(e) => setMinStr(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-max">Max thickness ({lenUnit})</Label>
              <Input
                id="cp-max"
                className="font-mono tabular-nums"
                disabled={noMax}
                value={maxStr}
                onChange={(e) => setMaxStr(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={noMax}
              onChange={(e) => {
                setNoMax(e.target.checked);
                if (e.target.checked) setMaxStr("");
              }}
              className="rounded border-input"
            />
            <span className="text-muted-foreground">No upper limit (and above)</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Default spacing</Label>
              <Input
                className="font-mono tabular-nums"
                value={spacingStr}
                onChange={(e) => setSpacingStr(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Default edge margin</Label>
              <Input
                className="font-mono tabular-nums"
                value={edgeStr}
                onChange={(e) => setEdgeStr(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
            <Label htmlFor="cp-rot">Allow rotation</Label>
            <Switch
              id="cp-rot"
              checked={draft.allowRotation}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, allowRotation: v }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Rotation mode</Label>
            <Select
              value={draft.rotationMode}
              disabled={!draft.allowRotation}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, rotationMode: v as ProfileRotationMode }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninetyOnly">
                  {PROFILE_ROTATION_MODE_LABELS.ninetyOnly}
                </SelectItem>
                <SelectItem value="free">
                  {PROFILE_ROTATION_MODE_LABELS.free}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
            <Label htmlFor="cp-mark">Mark part name</Label>
            <Switch
              id="cp-mark"
              checked={draft.defaultMarkPartName}
              onCheckedChange={(v) =>
                setDraft((d) => ({ ...d, defaultMarkPartName: v }))
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
            <Label htmlFor="cp-client">Include client code</Label>
            <Switch
              id="cp-client"
              checked={draft.defaultIncludeClientCode}
              onCheckedChange={(v) =>
                setDraft((d) => ({ ...d, defaultIncludeClientCode: v }))
              }
            />
          </div>

          {formErrors.length > 0 ? (
            <ul className="text-sm text-destructive space-y-1 list-disc pl-4">
              {formErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Save rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
