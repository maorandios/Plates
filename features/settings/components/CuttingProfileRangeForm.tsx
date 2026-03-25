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
import {
  MIN_PLATE_THICKNESS_MM,
  validateCuttingProfileRangesForMethod,
} from "@/lib/settings/cuttingProfiles";
import type { UnitSystem } from "@/types/settings";
import type {
  CuttingMethod,
  CuttingProfileRange,
  ProfileRotationMode,
} from "@/types/production";
import {
  DEFAULT_CUTTING_PROFILE_RANGES,
  DEFAULT_THICKNESS_BAND_MAX_MM,
  PROFILE_ROTATION_MODE_LABELS,
} from "@/types/production";

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

function emptyDraft(
  method: CuttingMethod,
  sortOrder: number,
  siblings: CuttingProfileRange[]
): CuttingProfileRange {
  const seed = DEFAULT_CUTTING_PROFILE_RANGES.filter((r) => r.method === method).sort(
    (a, b) => a.sortOrder - b.sortOrder
  )[0];
  const now = new Date().toISOString();
  const maxBand = seed?.maxThicknessMm ?? DEFAULT_THICKNESS_BAND_MAX_MM;
  const isFirst = siblings.length === 0;
  /** First row: 1–100 mm. Additional row: 100 mm+ (touching band, no overlap). */
  return {
    id: nanoid(),
    method,
    minThicknessMm: isFirst ? MIN_PLATE_THICKNESS_MM : maxBand,
    maxThicknessMm: isFirst ? maxBand : null,
    defaultSpacingMm: seed?.defaultSpacingMm ?? 4,
    defaultEdgeMarginMm: seed?.defaultEdgeMarginMm ?? 8,
    allowRotation: true,
    rotationMode: seed?.rotationMode ?? "ninetyOnly",
    defaultMarkPartName: true,
    defaultIncludeClientCode: seed?.defaultIncludeClientCode ?? false,
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
    initial ?? emptyDraft(method, nextSortOrder(siblingRanges), siblingRanges)
  );
  const [minStr, setMinStr] = useState("");
  const [maxStr, setMaxStr] = useState("");
  const [noMax, setNoMax] = useState(false);
  const [spacingStr, setSpacingStr] = useState("");
  const [edgeStr, setEdgeStr] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const siblingKey = siblingRanges.map((r) => r.id).join("|");

  useEffect(() => {
    if (!open) return;
    const base =
      initial ?? emptyDraft(method, nextSortOrder(siblingRanges), siblingRanges);
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
  }, [open, initial?.id, method, unitSystem, siblingKey]);

  function handleSubmit() {
    const errors: string[] = [];
    const minMm = parseLengthInputToMm(minStr, unitSystem);
    if (
      minMm == null ||
      !Number.isFinite(minMm) ||
      minMm < MIN_PLATE_THICKNESS_MM
    ) {
      errors.push(
        `Min thickness must be at least ${MIN_PLATE_THICKNESS_MM} mm (sheet stock does not use 0 mm).`
      );
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
      allowRotation: true,
      defaultMarkPartName: true,
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
          <p className="text-xs text-muted-foreground -mt-2">
            Minimum is {MIN_PLATE_THICKNESS_MM} {lenUnit} — plate stock does not use 0 thickness.
          </p>
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

          <div className="space-y-2">
            <Label>Rotation</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Rotation is always allowed for nesting. Choose how parts may rotate.
            </p>
            <Select
              value={draft.rotationMode}
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

          <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2 space-y-1">
            <Label className="text-foreground">Marking</Label>
            <p className="text-sm text-muted-foreground">
              Part number is always included on nested parts.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
            <div className="space-y-0.5 pr-2">
              <Label htmlFor="cp-client">Include client name</Label>
              <p className="text-xs text-muted-foreground font-normal">
                Optional — adds the client to marking text when enabled.
              </p>
            </div>
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
