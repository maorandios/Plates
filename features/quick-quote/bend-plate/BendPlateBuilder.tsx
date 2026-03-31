"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Check, ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { nanoid } from "@/lib/utils/nanoid";
import { cn } from "@/lib/utils";
import type { MaterialType } from "@/types/materials";
import {
  DEFAULT_PLATE_FINISH,
  PLATE_FINISH_OPTIONS,
  defaultMaterialGradeForFamily,
  plateFinishLabel,
  type PlateFinish,
} from "../lib/plateFields";
import type {
  BendPlateFormState,
  BendPlateQuoteItem,
  BendPlateCalculation,
  BendTemplateId,
} from "./types";
import {
  bendProfileBendAngles,
  bendProfileDimensionSegments,
  computeBendGeometry,
  type Point2,
} from "./geometry";
import {
  createDefaultBendPlateFormState,
  createFormStateForTemplate,
  formStateFromQuoteItem,
} from "./defaults";
import { ProfilePreview2D } from "./ProfilePreview2D";
import { ProfilePreview3D } from "./ProfilePreview3D";

const TEMPLATE_OPTIONS: { id: BendTemplateId; label: string; hint: string }[] = [
  { id: "l", label: "L", hint: "Two legs" },
  { id: "u", label: "U", hint: "Channel" },
  { id: "z", label: "Z", hint: "Zig-zag" },
  { id: "hat", label: "Hat", hint: "Five bends" },
  { id: "custom", label: "Custom", hint: "≤ 6 segments" },
];

function templateLabel(id: BendTemplateId): string {
  const o = TEMPLATE_OPTIONS.find((x) => x.id === id);
  return o?.label ?? id;
}

/** Loose decimal text while typing (allows "-", "-.", partial numbers). */
const DECIMAL_TYPING = /^-?\d*\.?\d*$/;

function NumField({
  label,
  value,
  onChange,
  min,
  step: _step = 1,
  className,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  /** Reserved for future numeric spinners / hints. */
  step?: number;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [local, setLocal] = useState("");

  const display = focused
    ? local
    : Number.isFinite(value)
      ? String(value)
      : "";

  useEffect(() => {
    if (!focused) {
      setLocal(Number.isFinite(value) ? String(value) : "");
    }
  }, [value, focused]);

  const commitBlur = () => {
    setFocused(false);
    const raw = local.trim();
    if (raw === "" || raw === "-") {
      const fallback = min !== undefined ? min : 0;
      onChange(fallback);
      return;
    }
    let n = parseFloat(raw);
    if (Number.isNaN(n)) {
      n = Number.isFinite(value) ? value : min !== undefined ? min : 0;
    } else if (min !== undefined) {
      n = Math.max(min, n);
    }
    onChange(n);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground font-normal">{label}</Label>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="h-9 font-mono tabular-nums text-sm"
        value={display}
        onFocus={() => {
          setFocused(true);
          setLocal(Number.isFinite(value) ? String(value) : "");
        }}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw !== "" && !DECIMAL_TYPING.test(raw)) return;
          setLocal(raw);
          if (raw === "" || raw === "-") return;
          const n = parseFloat(raw);
          if (!Number.isNaN(n)) {
            onChange(n);
          }
        }}
        onBlur={commitBlur}
        aria-valuemin={min}
      />
    </div>
  );
}

function snapshotItem(
  state: BendPlateFormState,
  calc: BendPlateCalculation,
  existingId?: string | null
): BendPlateQuoteItem {
  return {
    id: existingId ?? nanoid(),
    inputMethod: "bend_plate",
    bendAngleSemantic: "internal",
    template: state.template,
    global: { ...state.global },
    l: { ...state.l },
    u: { ...state.u },
    z: { ...state.z },
    hat: { ...state.hat },
    custom: {
      segmentCount: state.custom.segmentCount,
      segmentsMm: [...state.custom.segmentsMm],
      anglesDeg: [...state.custom.anglesDeg],
    },
    calc: { ...calc },
  };
}

function aggregateMetrics(items: BendPlateQuoteItem[]) {
  let totalQty = 0;
  let totalAreaM2 = 0;
  let totalWeightKg = 0;
  for (const it of items) {
    const q = Math.max(1, Math.floor(it.global.quantity) || 1);
    totalQty += q;
    totalAreaM2 += it.calc.areaM2 * q;
    totalWeightKg += it.calc.weightKg;
  }
  return {
    shapeCount: items.length,
    totalQty,
    totalAreaM2,
    totalWeightKg,
  };
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums text-foreground mt-1">{value}</p>
    </div>
  );
}

interface BendPlateBuilderProps {
  materialType: MaterialType;
  quoteItems: BendPlateQuoteItem[];
  onAddItem: (item: BendPlateQuoteItem) => void;
  onUpdateItem: (item: BendPlateQuoteItem) => void;
  onRemoveItem: (id: string) => void;
}

export function BendPlateBuilder({
  materialType,
  quoteItems,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: BendPlateBuilderProps) {
  const [screen, setScreen] = useState<"hub" | "editor">("hub");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BendPlateFormState>(() => createDefaultBendPlateFormState());

  const { pts, calc } = useMemo(
    () => computeBendGeometry(form, materialType),
    [form, materialType]
  );

  const profileSegmentDims = useMemo(
    () => bendProfileDimensionSegments(form),
    [form]
  );

  const profileBendAnglesDeg = useMemo(() => bendProfileBendAngles(form), [form]);

  const patchGlobal = useCallback((patch: Partial<BendPlateFormState["global"]>) => {
    setForm((s) => ({ ...s, global: { ...s.global, ...patch } }));
  }, []);

  const openNewEditor = useCallback((template: BendTemplateId) => {
    setEditingId(null);
    setForm(() => {
      const next = createFormStateForTemplate(template);
      return {
        ...next,
        global: {
          ...next.global,
          material: defaultMaterialGradeForFamily(materialType),
          finish: next.global.finish ?? DEFAULT_PLATE_FINISH,
        },
      };
    });
    setScreen("editor");
  }, [materialType]);

  const openEditEditor = useCallback(
    (item: BendPlateQuoteItem) => {
      setEditingId(item.id);
      setForm(() => {
        const next = formStateFromQuoteItem(item);
        return {
          ...next,
          global: {
            ...next.global,
            material: next.global.material || defaultMaterialGradeForFamily(materialType),
            finish: next.global.finish ?? DEFAULT_PLATE_FINISH,
          },
        };
      });
      setScreen("editor");
    },
    [materialType]
  );

  const handleComplete = useCallback(() => {
    const item = snapshotItem(form, calc, editingId);
    if (editingId) {
      onUpdateItem(item);
    } else {
      onAddItem(item);
    }
    setScreen("hub");
    setEditingId(null);
    setForm(createDefaultBendPlateFormState());
  }, [form, calc, editingId, onAddItem, onUpdateItem]);

  const handleCancelEditor = useCallback(() => {
    setScreen("hub");
    setEditingId(null);
    setForm(createDefaultBendPlateFormState());
  }, []);

  const hubMetrics = useMemo(() => aggregateMetrics(quoteItems), [quoteItems]);

  if (screen === "editor") {
    return (
      <BendPlateShapeEditor
        form={form}
        setForm={setForm}
        pts={pts}
        calc={calc}
        profileSegmentDims={profileSegmentDims}
        profileBendAnglesDeg={profileBendAnglesDeg}
        patchGlobal={patchGlobal}
        title={editingId ? `Edit · ${templateLabel(form.template)}` : `New · ${templateLabel(form.template)}`}
        onComplete={handleComplete}
        onCancel={handleCancelEditor}
      />
    );
  }

  return (
    <BendPlateHub
      quoteItems={quoteItems}
      hubMetrics={hubMetrics}
      onSelectTemplate={openNewEditor}
      onEdit={openEditEditor}
      onRemove={onRemoveItem}
    />
  );
}

function BendPlateHub({
  quoteItems,
  hubMetrics,
  onSelectTemplate,
  onEdit,
  onRemove,
}: {
  quoteItems: BendPlateQuoteItem[];
  hubMetrics: ReturnType<typeof aggregateMetrics>;
  onSelectTemplate: (t: BendTemplateId) => void;
  onEdit: (item: BendPlateQuoteItem) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bent plate builder
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Choose a profile shape to configure dimensions and bends. Complete each plate to add it to
          the list below — you can edit or remove lines anytime.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Shape template
        </h2>
        <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1">
          {TEMPLATE_OPTIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTemplate(t.id)}
              className={cn(
                "min-w-[140px] shrink-0 flex-1 rounded-lg border-2 px-4 py-4 text-left transition-all",
                "border-border bg-card hover:border-primary/40 hover:shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              <span className="block text-lg font-bold text-foreground">{t.label}</span>
              <span className="text-[11px] text-muted-foreground leading-snug block mt-1">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Shapes" value={formatInteger(hubMetrics.shapeCount)} />
          <MetricCard label="Quantity" value={formatInteger(hubMetrics.totalQty)} />
          <MetricCard label="Area (m²)" value={formatDecimal(hubMetrics.totalAreaM2, 3)} />
          <MetricCard label="Weight (kg)" value={formatDecimal(hubMetrics.totalWeightKg, 2)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Plates
        </h2>
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/20 py-3">
            <CardTitle className="text-base">Configured plates</CardTitle>
            <CardDescription>
              {quoteItems.length === 0
                ? "No plates yet — pick a shape above to start."
                : `${formatInteger(quoteItems.length)} line(s) on this quote`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {quoteItems.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 py-8 text-center">
                Your bent plates will appear here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Shape</TableHead>
                    <TableHead>Material grade</TableHead>
                    <TableHead>Finish</TableHead>
                    <TableHead className="text-right">Thk (mm)</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Area (m²)</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quoteItems.map((it) => {
                    const q = Math.max(1, Math.floor(it.global.quantity) || 1);
                    const lineArea = it.calc.areaM2 * q;
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium capitalize">
                          {templateLabel(it.template)}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[160px] truncate">
                          {it.global.material || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {plateFinishLabel(it.global.finish)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDecimal(it.global.thicknessMm, 2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatInteger(q)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDecimal(lineArea, 3)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDecimal(it.calc.weightKg, 2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Edit"
                              onClick={() => onEdit(it)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              aria-label="Delete"
                              onClick={() => onRemove(it.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/** Viewport fill below Quick Quote stepper + page padding — keeps editor on one screen without page scroll. */
const BEND_EDITOR_VIEWPORT =
  "min-h-[280px] min-h-0 h-[calc(100svh-14rem)] max-h-[calc(100svh-14rem)]";

function BendPlateShapeEditor({
  form,
  setForm,
  pts,
  calc,
  profileSegmentDims,
  profileBendAnglesDeg,
  patchGlobal,
  title,
  onComplete,
  onCancel,
}: {
  form: BendPlateFormState;
  setForm: Dispatch<SetStateAction<BendPlateFormState>>;
  pts: Point2[];
  calc: BendPlateCalculation;
  profileSegmentDims: ReturnType<typeof bendProfileDimensionSegments>;
  profileBendAnglesDeg: ReturnType<typeof bendProfileBendAngles>;
  patchGlobal: (patch: Partial<BendPlateFormState["global"]>) => void;
  title: string;
  onComplete: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[1800px] mx-auto flex-col gap-0 overflow-hidden",
        BEND_EDITOR_VIEWPORT
      )}
    >
      <div className="shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 pb-3 border-b border-border/80">
        <Button type="button" variant="outline" size="sm" className="gap-1 shrink-0" onClick={onCancel}>
          <ChevronLeft className="h-4 w-4" />
          Cancel
        </Button>
        <div className="min-w-0 flex-1 basis-[200px]">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Parameters in the sidebar — 2D and 3D previews side by side. Scroll the sidebar if
            needed.
          </p>
        </div>
        <Button type="button" size="lg" className="gap-2 shrink-0" onClick={onComplete}>
          <Check className="h-4 w-4" />
          Complete
        </Button>
      </div>

      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 py-3">
        <SummaryTile
          compact
          label="Developed length"
          value={`${formatDecimal(calc.developedLengthMm, 1)} mm`}
        />
        <SummaryTile compact label="Blank width" value={`${formatDecimal(calc.blankWidthMm, 1)} mm`} />
        <SummaryTile compact label="Area" value={`${formatDecimal(calc.areaM2, 3)} m²`} />
        <SummaryTile compact label="Est. weight" value={`${formatDecimal(calc.weightKg, 2)} kg`} />
        <SummaryTile compact label="Bends" value={formatInteger(calc.bendCount)} />
      </div>

      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-lg border border-border bg-muted/20">
        <aside className="flex w-full min-w-0 max-w-[420px] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-border bg-card">
          <div className="space-y-6 p-4">
            <div className="space-y-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Global parameters
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">This plate line</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground font-normal">Material grade</Label>
                  <Input
                    className="h-9 text-sm"
                    value={form.global.material}
                    onChange={(e) => patchGlobal({ material: e.target.value })}
                    placeholder="e.g. S235"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground font-normal">Finish</Label>
                  <Select
                    value={form.global.finish}
                    onValueChange={(v) => patchGlobal({ finish: v as PlateFinish })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATE_FINISH_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <NumField
                  label="Thickness (mm)"
                  value={form.global.thicknessMm}
                  onChange={(n) => patchGlobal({ thicknessMm: Math.max(0.1, n) })}
                  min={0.1}
                  step={0.01}
                />
                <NumField
                  label="Plate width (mm)"
                  value={form.global.plateWidthMm}
                  onChange={(n) => patchGlobal({ plateWidthMm: Math.max(1, n) })}
                  min={1}
                />
                <NumField
                  label="Inside bend radius (mm)"
                  value={form.global.insideRadiusMm}
                  onChange={(n) => patchGlobal({ insideRadiusMm: Math.max(0.1, n) })}
                  min={0.1}
                  step={0.01}
                />
                <NumField
                  label="Quantity"
                  value={form.global.quantity}
                  onChange={(n) => patchGlobal({ quantity: Math.max(1, Math.floor(n) || 1) })}
                  min={1}
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Template dimensions
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  mm · L/U/Z/hat angles = included angle between legs (side view)
                </p>
              </div>
              <TemplateFields form={form} setForm={setForm} />
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-2 sm:p-3 md:flex-row md:items-stretch md:gap-4">
            <div className="flex min-h-[200px] min-w-0 flex-1 flex-col md:min-h-0">
              <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5 pb-2">
                2D side profile
              </p>
              <div className="relative flex min-h-0 flex-1 items-stretch overflow-hidden rounded-lg border border-border/70 bg-[#0f1419] p-2.5 sm:p-3 md:min-h-[220px]">
                <ProfilePreview2D
                  pts={pts}
                  segments={profileSegmentDims}
                  bendAnglesDeg={profileBendAnglesDeg}
                  fill
                  className="h-full w-full min-h-0 rounded-md border-0 bg-transparent"
                />
              </div>
            </div>
            <div className="flex min-h-[200px] min-w-0 flex-1 flex-col md:min-h-0">
              <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5 pb-2">
                3D extruded · width = plate width
              </p>
              <div className="relative flex min-h-0 flex-1 items-stretch overflow-hidden rounded-lg border border-border/70 bg-[#0f1419] p-2.5 sm:p-3 md:min-h-[220px]">
                <ProfilePreview3D
                  pts={pts}
                  plateWidthMm={form.global.plateWidthMm}
                  thicknessMm={form.global.thicknessMm}
                  fill
                  className="h-full w-full min-h-0 rounded-md border-0 bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        compact ? "px-2.5 py-2" : "px-3 py-3"
      )}
    >
      <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </p>
      <p
        className={cn(
          "font-semibold tabular-nums text-foreground mt-0.5 leading-tight",
          compact ? "text-sm sm:text-base" : "text-base"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TemplateFields({
  form,
  setForm,
}: {
  form: BendPlateFormState;
  setForm: Dispatch<SetStateAction<BendPlateFormState>>;
}) {
  const t = form.template;

  if (t === "l") {
    return (
      <div className="grid sm:grid-cols-3 gap-4">
        <NumField
          label="A (mm)"
          value={form.l.aMm}
          onChange={(n) => setForm((s) => ({ ...s, l: { ...s.l, aMm: Math.max(0, n) } }))}
          min={0}
        />
        <NumField
          label="B (mm)"
          value={form.l.bMm}
          onChange={(n) => setForm((s) => ({ ...s, l: { ...s.l, bMm: Math.max(0, n) } }))}
          min={0}
        />
        <NumField
          label="Included angle (°)"
          value={form.l.angleDeg}
          onChange={(n) =>
            setForm((s) => ({
              ...s,
              l: { ...s.l, angleDeg: Math.min(180, Math.max(0, n)) },
            }))
          }
          step={0.1}
        />
      </div>
    );
  }

  if (t === "u") {
    const block = form.u;
    return (
      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <NumField
          label="A (mm)"
          value={block.aMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, u: { ...s.u, aMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="B (mm)"
          value={block.bMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, u: { ...s.u, bMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="C (mm)"
          value={block.cMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, u: { ...s.u, cMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="Included angle 1 (°)"
          value={block.angle1Deg}
          onChange={(n) =>
            setForm((s) => ({
              ...s,
              u: { ...s.u, angle1Deg: Math.min(180, Math.max(0, n)) },
            }))
          }
          step={0.1}
        />
        <NumField
          label="Included angle 2 (°)"
          value={block.angle2Deg}
          onChange={(n) =>
            setForm((s) => ({
              ...s,
              u: { ...s.u, angle2Deg: Math.min(180, Math.max(0, n)) },
            }))
          }
          step={0.1}
        />
      </div>
    );
  }

  if (t === "z") {
    const block = form.z;
    return (
      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <NumField
          label="A (mm)"
          value={block.aMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, z: { ...s.z, aMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="B (mm)"
          value={block.bMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, z: { ...s.z, bMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="C (mm)"
          value={block.cMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, z: { ...s.z, cMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="Included angle 1 (°)"
          value={block.angle1Deg}
          onChange={(n) =>
            setForm((s) => ({
              ...s,
              z: { ...s.z, angle1Deg: Math.min(180, Math.max(0, n)) },
            }))
          }
          step={0.1}
        />
        <NumField
          label="Included angle 2 (°)"
          value={block.angle2Deg}
          onChange={(n) =>
            setForm((s) => ({
              ...s,
              z: { ...s.z, angle2Deg: Math.min(180, Math.max(0, n)) },
            }))
          }
          step={0.1}
        />
      </div>
    );
  }

  if (t === "hat") {
    const h = form.hat;
    return (
      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <NumField
          label="A (mm)"
          value={h.aMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, hat: { ...s.hat, aMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="B (mm)"
          value={h.bMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, hat: { ...s.hat, bMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="C (mm)"
          value={h.cMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, hat: { ...s.hat, cMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="D (mm)"
          value={h.dMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, hat: { ...s.hat, dMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="E (mm)"
          value={h.eMm}
          onChange={(n) =>
            setForm((s) => ({ ...s, hat: { ...s.hat, eMm: Math.max(0, n) } }))
          }
          min={0}
        />
        <NumField
          label="Included angle 1 (°)"
          value={h.angle1Deg}
          onChange={(n) =>
            setForm((s) => ({
              ...s,
              hat: { ...s.hat, angle1Deg: Math.min(180, Math.max(0, n)) },
            }))
          }
          step={0.1}
        />
        <NumField
          label="Included angle 2 (°)"
          value={h.angle2Deg}
          onChange={(n) =>
            setForm((s) => ({
              ...s,
              hat: { ...s.hat, angle2Deg: Math.min(180, Math.max(0, n)) },
            }))
          }
          step={0.1}
        />
        <NumField
          label="Included angle 3 (°)"
          value={h.angle3Deg}
          onChange={(n) =>
            setForm((s) => ({
              ...s,
              hat: { ...s.hat, angle3Deg: Math.min(180, Math.max(0, n)) },
            }))
          }
          step={0.1}
        />
        <NumField
          label="Included angle 4 (°)"
          value={h.angle4Deg}
          onChange={(n) =>
            setForm((s) => ({
              ...s,
              hat: { ...s.hat, angle4Deg: Math.min(180, Math.max(0, n)) },
            }))
          }
          step={0.1}
        />
      </div>
    );
  }

  if (t === "custom") {
    const c = form.custom;
    const n = Math.min(6, Math.max(2, c.segmentCount));
    return (
      <div className="space-y-4">
        <div className="max-w-xs space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Segment count</Label>
          <Select
            value={String(n)}
            onValueChange={(v) => {
              const next = Math.min(6, Math.max(2, parseInt(v, 10)));
              setForm((s) => ({
                ...s,
                custom: { ...s.custom, segmentCount: next },
              }));
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5, 6].map((x) => (
                <SelectItem key={x} value={String(x)}>
                  {x} segments
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {Array.from({ length: n }, (_, i) => (
            <NumField
              key={`s-${i}`}
              label={`Segment ${i + 1} (mm)`}
              value={c.segmentsMm[i] ?? 0}
              onChange={(v) =>
                setForm((s) => {
                  const next = [...s.custom.segmentsMm];
                  while (next.length < 6) next.push(0);
                  next[i] = Math.max(0, v);
                  return { ...s, custom: { ...s.custom, segmentsMm: next } };
                })
              }
              min={0}
            />
          ))}
        </div>
        {n > 1 ? (
          <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: n - 1 }, (_, i) => (
              <NumField
                key={`a-${i}`}
                label={`Path turn after seg. ${i + 1} (°, CCW +)`}
                value={c.anglesDeg[i] ?? 0}
                onChange={(v) =>
                  setForm((s) => {
                    const next = [...s.custom.anglesDeg];
                    while (next.length < 5) next.push(0);
                    next[i] = v;
                    return { ...s, custom: { ...s.custom, anglesDeg: next } };
                  })
                }
                step={0.1}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
