"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { nanoid } from "@/lib/utils/nanoid";
import type { Client } from "@/types";
import { plateBuilderFormSchema, type PlateBuilderFormValues } from "../schema";
import type { PlateBuilderSpecV1 } from "../types";
import { saveBuiltPlateToBatch } from "../lib/saveBuiltPlate";

const PlatePreviewCanvas = dynamic(
  () =>
    import("./PlatePreviewCanvas").then((m) => m.PlatePreviewCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] w-full items-center justify-center rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground">
        Loading preview…
      </div>
    ),
  }
);

function formValuesToSpec(values: PlateBuilderFormValues): PlateBuilderSpecV1 {
  return {
    version: 1,
    shapeType: values.shapeType,
    width: values.width,
    height: values.height,
    cornerRadius: values.cornerRadius,
    chamferSize: values.chamferSize,
    holes: values.holes,
    slots: values.slots,
    partName: values.partName,
    quantity: values.quantity,
    material: values.material,
    thickness: values.thickness,
    clientId: values.clientId,
  };
}

function previewNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() === "") return Number.NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

function previewSpecFromValues(values: PlateBuilderFormValues): PlateBuilderSpecV1 {
  const w = previewNumber(values.width);
  const h = previewNumber(values.height);
  // RHF often keeps number inputs as strings while typing — Number.isFinite("10") is false.
  const cornerRadius = previewNumber(values.cornerRadius);
  const chamferSize = previewNumber(values.chamferSize);
  const thickness = previewNumber(values.thickness);
  return {
    version: 1,
    shapeType: values.shapeType,
    width: w,
    height: h,
    cornerRadius: Number.isFinite(cornerRadius) ? cornerRadius : 0,
    chamferSize: Number.isFinite(chamferSize) ? chamferSize : 0,
    holes: values.holes,
    slots: values.slots,
    partName: values.partName || "Preview",
    quantity: 1,
    material: values.material || "—",
    thickness: Number.isFinite(thickness) ? thickness : 6,
    clientId: values.clientId || "preview",
  };
}

interface PlateBuilderFormProps {
  batchId: string;
  clients: Client[];
  defaultClientId: string;
}

export function PlateBuilderForm({
  batchId,
  clients,
  defaultClientId,
}: PlateBuilderFormProps) {
  const router = useRouter();
  const initialClient =
    defaultClientId && clients.some((c) => c.id === defaultClientId)
      ? defaultClientId
      : clients[0]?.id ?? "";

  const form = useForm<PlateBuilderFormValues>({
    resolver: zodResolver(
      plateBuilderFormSchema
    ) as Resolver<PlateBuilderFormValues>,
    defaultValues: {
      shapeType: "rectangle",
      width: 200,
      height: 120,
      cornerRadius: 12,
      chamferSize: 10,
      holes: [],
      slots: [],
      partName: "",
      quantity: 1,
      material: "",
      thickness: 10,
      clientId: initialClient,
    },
    mode: "onChange",
  });

  const { control, handleSubmit, setValue, formState, register } = form;

  useEffect(() => {
    if (initialClient) setValue("clientId", initialClient);
  }, [initialClient, setValue]);

  const holesArr = useFieldArray({ control, name: "holes" });
  const slotsArr = useFieldArray({ control, name: "slots" });

  const watched = useWatch({ control }) as PlateBuilderFormValues | undefined;
  const previewSpec = previewSpecFromValues(
    watched ?? (form.getValues() as PlateBuilderFormValues)
  );

  const shapeType = watched?.shapeType ?? "rectangle";

  const onSubmit = (data: PlateBuilderFormValues) => {
    const spec = formValuesToSpec(data);
    saveBuiltPlateToBatch(spec, batchId);
    router.push(`/batches/${batchId}/parts`);
  };

  const busy = formState.isSubmitting;

  return (
    <PageContainer embedded>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">
          Quick Plate Builder
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
          Define a simple steel plate shape, holes, and slots. A real DXF is
          saved and appears in Validation like any uploaded drawing.
        </p>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Add at least one client to this batch on Import data before building
            a plate.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          <section className="w-full flex flex-col items-stretch">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Live preview
            </p>
            <PlatePreviewCanvas
              spec={previewSpec}
              onHoleCenterChange={(index, cx, cy) => {
                setValue(`holes.${index}.cx`, cx, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                setValue(`holes.${index}.cy`, cy, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              onSlotCenterChange={(index, cx, cy) => {
                setValue(`slots.${index}.cx`, cx, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                setValue(`slots.${index}.cy`, cy, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
          </section>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 max-w-xl mx-auto w-full"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Shape</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Base shape</Label>
                  <Select
                    value={shapeType}
                    onValueChange={(v) =>
                      setValue(
                        "shapeType",
                        v as PlateBuilderFormValues["shapeType"]
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rectangle">Rectangle</SelectItem>
                      <SelectItem value="rectangleRounded">
                        Rectangle — rounded corners
                      </SelectItem>
                      <SelectItem value="rectangleChamfered">
                        Rectangle — chamfered corners
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="width">Width (mm)</Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.1"
                      min={0.001}
                      {...form.register("width")}
                    />
                    {formState.errors.width && (
                      <p className="text-xs text-destructive">
                        {formState.errors.width.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (mm)</Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.1"
                      min={0.001}
                      {...form.register("height")}
                    />
                    {formState.errors.height && (
                      <p className="text-xs text-destructive">
                        {formState.errors.height.message}
                      </p>
                    )}
                  </div>
                </div>

                {shapeType === "rectangleRounded" && (
                  <div className="space-y-2">
                    <Label htmlFor="cornerRadius">Corner radius (mm)</Label>
                    <Input
                      id="cornerRadius"
                      type="number"
                      step="0.1"
                      min={0}
                      {...form.register("cornerRadius")}
                    />
                    {formState.errors.cornerRadius && (
                      <p className="text-xs text-destructive">
                        {formState.errors.cornerRadius.message}
                      </p>
                    )}
                  </div>
                )}

                {shapeType === "rectangleChamfered" && (
                  <div className="space-y-2">
                    <Label htmlFor="chamferSize">Chamfer (mm)</Label>
                    <Input
                      id="chamferSize"
                      type="number"
                      step="0.1"
                      min={0}
                      {...form.register("chamferSize")}
                    />
                    {formState.errors.chamferSize && (
                      <p className="text-xs text-destructive">
                        {formState.errors.chamferSize.message}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Holes</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    holesArr.append({
                      id: nanoid(),
                      cx: 50,
                      cy: 50,
                      diameter: 10,
                      length: 0,
                      rotationDeg: 0,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add hole
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {holesArr.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Round holes (Ø) or slotted holes (length × Ø, rounded ends).
                    Position is set in the live preview (5 mm snap).
                  </p>
                ) : (
                  holesArr.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex flex-wrap items-end gap-2 gap-y-2 rounded-lg border border-border p-3"
                    >
                      <input
                        type="hidden"
                        {...register(`holes.${index}.id` as const)}
                      />
                      <input
                        type="hidden"
                        {...register(`holes.${index}.cx` as const)}
                      />
                      <input
                        type="hidden"
                        {...register(`holes.${index}.cy` as const)}
                      />
                      <div className="space-y-1">
                        <Label className="text-xs">Ø (mm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min={0}
                          className="h-9 w-[76px]"
                          {...form.register(`holes.${index}.diameter` as const)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Slot length</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min={0}
                          className="h-9 w-[76px]"
                          {...form.register(`holes.${index}.length` as const)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Rot °</Label>
                        <Input
                          type="number"
                          step="1"
                          className="h-9 w-[72px]"
                          {...form.register(
                            `holes.${index}.rotationDeg` as const
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground"
                        title="Remove hole"
                        onClick={() => holesArr.remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <p className="w-full text-[11px] text-muted-foreground">
                        Slotted: set length ≥ Ø (width matches Ø, ends stay
                        round). Round: leave slot length at 0.
                      </p>
                    </div>
                  ))
                )}
                {formState.errors.holes?.root?.message && (
                  <p className="text-xs text-destructive">
                    {String(formState.errors.holes.root.message)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Slots</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    slotsArr.append({
                      id: nanoid(),
                      cx: 100,
                      cy: 60,
                      length: 40,
                      width: 12,
                      rotationDeg: 0,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add slot
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {slotsArr.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Rectangular slots (length × width, rotation in °). Position
                    is set in the live preview.
                  </p>
                ) : (
                  slotsArr.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex flex-wrap items-end gap-2 gap-y-2 rounded-lg border border-border p-3"
                    >
                      <input
                        type="hidden"
                        {...register(`slots.${index}.id` as const)}
                      />
                      <input
                        type="hidden"
                        {...register(`slots.${index}.cx` as const)}
                      />
                      <input
                        type="hidden"
                        {...register(`slots.${index}.cy` as const)}
                      />
                      <div className="space-y-1">
                        <Label className="text-xs">Length</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min={0.001}
                          className="h-9 w-[76px]"
                          {...form.register(`slots.${index}.length` as const)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Width</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min={0.001}
                          className="h-9 w-[76px]"
                          {...form.register(`slots.${index}.width` as const)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Rot °</Label>
                        <Input
                          type="number"
                          step="1"
                          className="h-9 w-[72px]"
                          {...form.register(`slots.${index}.rotationDeg` as const)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground"
                        title="Remove slot"
                        onClick={() => slotsArr.remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Part &amp; material</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client</Label>
                  <Select
                    value={watched?.clientId || ""}
                    onValueChange={(v) => setValue("clientId", v)}
                  >
                    <SelectTrigger id="clientId">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.shortCode} — {c.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formState.errors.clientId && (
                    <p className="text-xs text-destructive">
                      {formState.errors.clientId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partName">Part name</Label>
                  <Input
                    id="partName"
                    placeholder="e.g. Base plate A"
                    {...form.register("partName")}
                  />
                  {formState.errors.partName && (
                    <p className="text-xs text-destructive">
                      {formState.errors.partName.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="1"
                      min={1}
                      {...form.register("quantity")}
                    />
                    {formState.errors.quantity && (
                      <p className="text-xs text-destructive">
                        {formState.errors.quantity.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="thickness">Thickness (mm)</Label>
                    <Input
                      id="thickness"
                      type="number"
                      step="0.1"
                      min={0.001}
                      {...form.register("thickness")}
                    />
                    {formState.errors.thickness && (
                      <p className="text-xs text-destructive">
                        {formState.errors.thickness.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="material">Material</Label>
                  <Input
                    id="material"
                    placeholder="e.g. S355"
                    {...form.register("material")}
                  />
                  {formState.errors.material && (
                    <p className="text-xs text-destructive">
                      {formState.errors.material.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save plate & DXF"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push(`/batches/${batchId}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </PageContainer>
  );
}
