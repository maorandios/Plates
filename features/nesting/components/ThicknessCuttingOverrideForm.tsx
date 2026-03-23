"use client";

import { useEffect, useState } from "react";
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
import { saveBatchThicknessOverride } from "@/lib/nesting/thicknessOverrides";
import type { ResolvedThicknessCuttingRule } from "@/lib/nesting/resolvedCuttingRules";
import type { Batch } from "@/types";
import type { UnitSystem } from "@/types/settings";
import type { BatchThicknessOverride } from "@/types/nesting";
import type { ProfileRotationMode } from "@/types/production";
import { PROFILE_ROTATION_MODE_LABELS } from "@/types/production";
import { thicknessGroupKey } from "@/lib/nesting/stockConfiguration";

interface ThicknessCuttingOverrideFormProps {
  batch: Batch;
  thicknessMm: number | null;
  unitSystem: UnitSystem;
  resolved: ResolvedThicknessCuttingRule;
  onSaved: () => void;
  onCancel: () => void;
}

export function ThicknessCuttingOverrideForm({
  batch,
  thicknessMm,
  unitSystem,
  resolved,
  onSaved,
  onCancel,
}: ThicknessCuttingOverrideFormProps) {
  const [spacingStr, setSpacingStr] = useState("");
  const [edgeStr, setEdgeStr] = useState("");
  const [allowRotation, setAllowRotation] = useState(true);
  const [rotationMode, setRotationMode] =
    useState<ProfileRotationMode>("ninetyOnly");
  const [markPart, setMarkPart] = useState(true);
  const [includeClient, setIncludeClient] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setSpacingStr(formatLengthValueOnly(resolved.spacingMm, unitSystem));
    setEdgeStr(formatLengthValueOnly(resolved.edgeMarginMm, unitSystem));
    setAllowRotation(resolved.allowRotation);
    setRotationMode(resolved.rotationMode);
    setMarkPart(resolved.defaultMarkPartName);
    setIncludeClient(resolved.defaultIncludeClientCode);
    setErrors([]);
  }, [
    resolved.spacingMm,
    resolved.edgeMarginMm,
    resolved.allowRotation,
    resolved.rotationMode,
    resolved.defaultMarkPartName,
    resolved.defaultIncludeClientCode,
    unitSystem,
  ]);

  function handleSave() {
    const nextErrors: string[] = [];
    const sp = parseLengthInputToMm(spacingStr, unitSystem);
    const ed = parseLengthInputToMm(edgeStr, unitSystem);
    if (sp == null || sp < 0 || !Number.isFinite(sp)) {
      nextErrors.push("Spacing must be a number ≥ 0.");
    }
    if (ed == null || ed < 0 || !Number.isFinite(ed)) {
      nextErrors.push("Edge margin must be a number ≥ 0.");
    }
    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }

    const entry: BatchThicknessOverride = {
      id: resolved.overrideRecord?.id ?? nanoid(),
      batchId: batch.id,
      thicknessMm,
      spacingMm: sp!,
      edgeMarginMm: ed!,
      allowRotation,
      rotationMode: allowRotation ? rotationMode : "ninetyOnly",
      defaultMarkPartName: markPart,
      defaultIncludeClientCode: includeClient,
      updatedAt: new Date().toISOString(),
    };

    saveBatchThicknessOverride(entry);
    setErrors([]);
    onSaved();
  }

  return (
    <div className="mt-2 pt-3 border-t border-border/60 space-y-4">
      <p className="text-[11px] text-muted-foreground">
        Saved only for this batch. Global Settings profiles are unchanged.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Spacing</Label>
          <Input
            className="h-9 font-mono tabular-nums text-sm"
            value={spacingStr}
            onChange={(e) => setSpacingStr(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Edge margin</Label>
          <Input
            className="h-9 font-mono tabular-nums text-sm"
            value={edgeStr}
            onChange={(e) => setEdgeStr(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
        <Label htmlFor={`allow-rot-${batch.id}`} className="text-xs">
          Allow rotation
        </Label>
        <Switch
          id={`allow-rot-${batch.id}-${thicknessGroupKey(thicknessMm)}`}
          checked={allowRotation}
          onCheckedChange={setAllowRotation}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Rotation mode</Label>
        <Select
          value={rotationMode}
          disabled={!allowRotation}
          onValueChange={(v) => setRotationMode(v as ProfileRotationMode)}
        >
          <SelectTrigger className="h-9">
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

      <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
        <Label className="text-xs">Mark part name</Label>
        <Switch checked={markPart} onCheckedChange={setMarkPart} />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
        <Label className="text-xs">Include client code</Label>
        <Switch checked={includeClient} onCheckedChange={setIncludeClient} />
      </div>

      {errors.length > 0 ? (
        <ul className="text-xs text-destructive space-y-0.5 list-disc pl-4">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={handleSave}>
          Save for this batch
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
