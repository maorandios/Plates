"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ArrowLeft, Check, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/types/materials";
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
import { getBendEditorValidationLines } from "./bendEditorValidation";
import { ProfilePreview2D } from "./ProfilePreview2D";
import { ProfilePreview3D } from "./ProfilePreview3D";

const TEMPLATE_OPTIONS: { id: BendTemplateId; label: string; hint: string }[] = [
  { id: "l", label: "L", hint: "Two legs" },
  { id: "u", label: "U", hint: "Channel" },
  { id: "z", label: "Z", hint: "Zig-zag" },
  { id: "custom", label: "Custom", hint: "≤ 7 segments" },
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
    const q = Math.max(0, Math.floor(it.global.quantity) || 0);
    totalQty += q;
    totalAreaM2 += it.calc.areaM2 * q;
    totalWeightKg += it.calc.weightKg;
  }
  return {
    totalQty,
    totalAreaM2,
    totalWeightKg,
  };
}

/** Fill parent (Quick Quote step 3 shell uses flex-1 min-h-0). */
const BEND_PLATE_FILL =
  "flex h-full min-h-0 w-full max-h-full flex-col overflow-hidden";

/** One row in the left sidebar — matches Manual add parts metric strips. */
function BendPlateHubMetricStrip({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-5 py-5 sm:px-7 sm:py-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className="font-semibold tabular-nums tracking-tight text-foreground leading-none
          text-[clamp(2rem,6.5vmin,4.25rem)]"
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground leading-snug pt-1 max-w-[18rem]">{sub}</p>
    </div>
  );
}

interface BendPlateBuilderProps {
  materialType: MaterialType;
  quoteItems: BendPlateQuoteItem[];
  onAddItem: (item: BendPlateQuoteItem) => void;
  onUpdateItem: (item: BendPlateQuoteItem) => void;
  onRemoveItem: (id: string) => void;
  /** Return to the quote method step. */
  onBack: () => void;
  /** Finish this phase and return to the quote method step (e.g. after validation). */
  onComplete: () => void;
}

export function BendPlateBuilder({
  materialType,
  quoteItems,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onBack,
  onComplete,
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
        profileSegmentDims={profileSegmentDims}
        profileBendAnglesDeg={profileBendAnglesDeg}
        patchGlobal={patchGlobal}
        onComplete={handleComplete}
        onCancel={handleCancelEditor}
      />
    );
  }

  return (
    <BendPlateHub
      materialType={materialType}
      quoteItems={quoteItems}
      hubMetrics={hubMetrics}
      onSelectTemplate={openNewEditor}
      onEdit={openEditEditor}
      onRemove={onRemoveItem}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}

function BendPlateHub({
  materialType,
  quoteItems,
  hubMetrics,
  onSelectTemplate,
  onEdit,
  onRemove,
  onBack,
  onComplete,
}: {
  materialType: MaterialType;
  quoteItems: BendPlateQuoteItem[];
  hubMetrics: ReturnType<typeof aggregateMetrics>;
  onSelectTemplate: (t: BendTemplateId) => void;
  onEdit: (item: BendPlateQuoteItem) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  onComplete: () => void;
}) {
  const plateTypeLabel = MATERIAL_TYPE_LABELS[materialType];
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [hubValidationOpen, setHubValidationOpen] = useState(false);

  const pickShape = (id: BendTemplateId) => {
    setShapePickerOpen(false);
    onSelectTemplate(id);
  };

  function handleHubCompleteClick() {
    if (quoteItems.length === 0) {
      setHubValidationOpen(true);
      return;
    }
    onComplete();
  }

  return (
    <div className={cn(BEND_PLATE_FILL)}>
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <aside className="flex h-full min-h-0 w-full max-w-[min(420px,42vw)] shrink-0 flex-col">
          <div className="shrink-0 space-y-2 px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-snug">
              Bent plate builder
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use <span className="font-medium text-foreground">Add part</span> to choose a shape,
              configure it in the editor, then complete to add it to the list. Edit or remove lines
              anytime.
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Plate type from General:{" "}
              <span className="font-medium text-foreground">{plateTypeLabel}</span>
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col divide-y divide-border/70">
            <BendPlateHubMetricStrip
              label="Quantity"
              value={formatInteger(hubMetrics.totalQty)}
              sub="Total pieces across configured plates"
            />
            <BendPlateHubMetricStrip
              label="Area (m²)"
              value={formatDecimal(hubMetrics.totalAreaM2, 3)}
              sub="Σ blank area × quantity per line"
            />
            <BendPlateHubMetricStrip
              label="Weight (kg)"
              value={formatDecimal(hubMetrics.totalWeightKg, 2)}
              sub="Estimated from geometry and density (General)"
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="shrink-0 border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">Configured plates</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {quoteItems.length === 0
                    ? "No plates yet — use Add part to choose L, U, Z, or Custom and configure your first line."
                    : `${formatInteger(quoteItems.length)} line(s) on this quote`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="gap-2"
                  onClick={onBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  size="default"
                  className="gap-2"
                  onClick={handleHubCompleteClick}
                >
                  <Check className="h-4 w-4" />
                  Complete
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-4 sm:p-5">
              {quoteItems.length === 0 ? (
                <div
                  className="flex min-h-[min(320px,50vh)] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12"
                >
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    No bent plates yet. Add a part to pick a profile shape and open the editor.
                  </p>
                  <Button
                    type="button"
                    size="default"
                    className="gap-2"
                    onClick={() => setShapePickerOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add part
                  </Button>
                </div>
              ) : (
                <>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="text-xs font-semibold w-12 text-center">#</TableHead>
                        <TableHead className="text-xs font-semibold w-[72px]">Shape</TableHead>
                        <TableHead className="text-xs font-semibold w-[120px] text-right">
                          Thickness (mm)
                        </TableHead>
                        <TableHead className="text-xs font-semibold w-[120px] text-right">
                          Width (mm)
                        </TableHead>
                        <TableHead className="text-xs font-semibold w-[120px] text-right">
                          Length (mm)
                        </TableHead>
                        <TableHead className="text-xs font-semibold w-[100px] text-right">
                          Quantity
                        </TableHead>
                        <TableHead className="text-xs font-semibold w-[120px] text-right">
                          Area (m²)
                        </TableHead>
                        <TableHead className="text-xs font-semibold w-[120px] text-right">
                          Weight (kg)
                        </TableHead>
                        <TableHead className="text-xs font-semibold min-w-[140px]">
                          Material grade
                        </TableHead>
                        <TableHead className="text-xs font-semibold min-w-[100px]">Finish</TableHead>
                        <TableHead className="text-xs font-semibold w-[100px] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quoteItems.map((it, index) => {
                        const q = Math.max(0, Math.floor(it.global.quantity) || 0);
                        const lineArea = it.calc.areaM2 * q;
                        return (
                          <TableRow key={it.id}>
                            <TableCell className="py-2 text-center text-muted-foreground text-sm tabular-nums">
                              {index + 1}
                            </TableCell>
                            <TableCell className="py-2 font-medium capitalize tabular-nums">
                              {templateLabel(it.template)}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums text-sm">
                              {formatDecimal(it.global.thicknessMm, 2)}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums text-sm">
                              {formatDecimal(it.calc.blankWidthMm, 1)}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums text-sm">
                              {formatDecimal(it.calc.blankLengthMm, 1)}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums text-sm">
                              {formatInteger(q)}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums text-sm">
                              {formatDecimal(lineArea, 3)}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums text-sm">
                              {formatDecimal(it.calc.weightKg, 2)}
                            </TableCell>
                            <TableCell className="py-2 text-muted-foreground max-w-[180px] truncate text-sm">
                              {it.global.material || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-muted-foreground whitespace-nowrap text-sm">
                              {plateFinishLabel(it.global.finish)}
                            </TableCell>
                            <TableCell className="py-2 text-right">
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
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => setShapePickerOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add part
                </Button>
                </>
              )}
            </div>
          </div>

          <Dialog open={shapePickerOpen} onOpenChange={setShapePickerOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add bent plate</DialogTitle>
                <DialogDescription>
                  Choose a profile shape. You will configure dimensions and material in the editor next.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {TEMPLATE_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickShape(t.id)}
                    className={cn(
                      "rounded-xl border-2 px-4 py-4 text-left transition-all",
                      "border-border bg-card hover:border-primary/50 hover:bg-muted/40 hover:shadow-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                  >
                    <span className="block text-lg font-bold text-foreground leading-tight tracking-tight">
                      {t.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-snug block mt-1">
                      {t.hint}
                    </span>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={hubValidationOpen} onOpenChange={setHubValidationOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add a plate first</DialogTitle>
                <DialogDescription>
                  Add at least one bent plate line before completing this step.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" onClick={() => setHubValidationOpen(false)}>
                  OK
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

function BendPlateShapeEditor({
  form,
  setForm,
  pts,
  profileSegmentDims,
  profileBendAnglesDeg,
  patchGlobal,
  onComplete,
  onCancel,
}: {
  form: BendPlateFormState;
  setForm: Dispatch<SetStateAction<BendPlateFormState>>;
  pts: Point2[];
  profileSegmentDims: ReturnType<typeof bendProfileDimensionSegments>;
  profileBendAnglesDeg: ReturnType<typeof bendProfileBendAngles>;
  patchGlobal: (patch: Partial<BendPlateFormState["global"]>) => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const resetTemplateShape = useCallback(() => {
    setForm((s) => {
      const d = createDefaultBendPlateFormState();
      switch (s.template) {
        case "l":
          return { ...s, l: { ...d.l } };
        case "u":
          return { ...s, u: { ...d.u } };
        case "z":
          return { ...s, z: { ...d.z } };
        case "custom":
          return { ...s, custom: { ...d.custom } };
        default:
          return s;
      }
    });
  }, [setForm]);

  const [preview3dOpen, setPreview3dOpen] = useState(false);
  const [saveValidationOpen, setSaveValidationOpen] = useState(false);
  const [saveValidationLines, setSaveValidationLines] = useState<string[]>([]);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);

  const handleSaveClick = useCallback(() => {
    const lines = getBendEditorValidationLines(form);
    if (lines) {
      setSaveValidationLines(lines);
      setSaveValidationOpen(true);
      return;
    }
    onComplete();
  }, [form, onComplete]);

  const handleBackClick = useCallback(() => {
    const lines = getBendEditorValidationLines(form);
    if (lines) {
      setBackConfirmOpen(true);
      return;
    }
    onCancel();
  }, [form, onCancel]);

  const confirmBackDiscard = useCallback(() => {
    setBackConfirmOpen(false);
    onCancel();
  }, [onCancel]);

  return (
    <div className={cn(BEND_PLATE_FILL)}>
      <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
        <aside className="flex w-2/5 min-w-0 flex-col bg-card">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Global parameters
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Thickness (mm)"
                    value={form.global.thicknessMm}
                    onChange={(n) => patchGlobal({ thicknessMm: Math.max(0, n) })}
                    min={0}
                    step={0.01}
                  />
                  <NumField
                    label="Plate width (mm)"
                    value={form.global.plateWidthMm}
                    onChange={(n) => patchGlobal({ plateWidthMm: Math.max(0, n) })}
                    min={0}
                  />
                  <NumField
                    label="Inside bend radius (mm)"
                    value={form.global.insideRadiusMm}
                    onChange={(n) => patchGlobal({ insideRadiusMm: Math.max(0, n) })}
                    min={0}
                    step={0.01}
                  />
                  <NumField
                    label="Quantity"
                    value={form.global.quantity}
                    onChange={(n) =>
                      patchGlobal({ quantity: Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)) })
                    }
                    min={0}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-normal">Material grade</Label>
                    <Input
                      className="h-9 text-sm"
                      value={form.global.material}
                      onChange={(e) => patchGlobal({ material: e.target.value })}
                      placeholder="e.g. S235"
                    />
                  </div>
                  <div className="space-y-1.5">
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
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Template dimensions
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      mm · included angle between legs (side view); 180° = straight
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={resetTemplateShape}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset shape
                  </Button>
                </div>
                <TemplateFields form={form} setForm={setForm} />
              </div>
            </div>
          </div>
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-5">
            <Button type="button" variant="outline" className="gap-2" onClick={handleBackClick}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button type="button" className="gap-2" onClick={handleSaveClick}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </aside>

        <div className="flex w-3/5 min-w-0 min-h-0 flex-col overflow-hidden bg-background">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#0f1419] p-1.5 sm:p-2">
              <ProfilePreview2D
                pts={pts}
                segments={profileSegmentDims}
                bendAnglesDeg={profileBendAnglesDeg}
                fill
                className="h-full w-full min-h-0 rounded-md border-0 bg-transparent"
              />
            </div>
            <div className="shrink-0 border-t border-border/80 bg-background px-3 py-2.5 sm:px-4 flex justify-center sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="min-w-[8rem]"
                onClick={() => setPreview3dOpen(true)}
              >
                Preview 3D
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={preview3dOpen} onOpenChange={setPreview3dOpen}>
        <DialogContent className="max-w-[min(96vw,56rem)] gap-0 p-0">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle>3D preview</DialogTitle>
            <DialogDescription className="text-sm">
              Extruded profile — width matches plate width.
            </DialogDescription>
          </DialogHeader>
          <div className="relative min-h-[min(70vh,560px)] w-full bg-[#0f1419] p-4 sm:p-5">
            <ProfilePreview3D
              pts={pts}
              plateWidthMm={form.global.plateWidthMm}
              thicknessMm={form.global.thicknessMm}
              fill
              className="h-full min-h-[min(64vh,500px)] w-full rounded-md border-0 bg-transparent"
            />
          </div>
          <DialogFooter className="border-t border-border px-6 py-3 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setPreview3dOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveValidationOpen} onOpenChange={setSaveValidationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete fields first</DialogTitle>
            <DialogDescription>
              Fix the following before you can save this plate line.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
            {saveValidationLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" onClick={() => setSaveValidationOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard incomplete edits?</DialogTitle>
            <DialogDescription>
              Some values are still missing or invalid. Going back will discard your changes on this
              plate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setBackConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="default" onClick={confirmBackDiscard}>
              Discard and go back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SEGMENT_DIM_BOX =
  "rounded-lg border border-border bg-muted/25 p-3 space-y-3";

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
      <div className="space-y-3">
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Leg A — bend
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="A (mm)"
              value={form.l.aMm}
              onChange={(n) => setForm((s) => ({ ...s, l: { ...s.l, aMm: Math.max(0, n) } }))}
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
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Leg B
          </p>
          <NumField
            label="B (mm)"
            value={form.l.bMm}
            onChange={(n) => setForm((s) => ({ ...s, l: { ...s.l, bMm: Math.max(0, n) } }))}
            min={0}
          />
        </div>
      </div>
    );
  }

  if (t === "u") {
    const block = form.u;
    return (
      <div className="space-y-3">
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Leg A — bend 1
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="A (mm)"
              value={block.aMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, u: { ...s.u, aMm: Math.max(0, n) } }))
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
          </div>
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Leg B — bend 2
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="B (mm)"
              value={block.bMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, u: { ...s.u, bMm: Math.max(0, n) } }))
              }
              min={0}
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
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Leg C
          </p>
          <NumField
            label="C (mm)"
            value={block.cMm}
            onChange={(n) =>
              setForm((s) => ({ ...s, u: { ...s.u, cMm: Math.max(0, n) } }))
            }
            min={0}
          />
        </div>
      </div>
    );
  }

  if (t === "z") {
    const block = form.z;
    return (
      <div className="space-y-3">
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Leg A — bend 1
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="A (mm)"
              value={block.aMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, z: { ...s.z, aMm: Math.max(0, n) } }))
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
          </div>
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Leg B — bend 2
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="B (mm)"
              value={block.bMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, z: { ...s.z, bMm: Math.max(0, n) } }))
              }
              min={0}
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
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Leg C
          </p>
          <NumField
            label="C (mm)"
            value={block.cMm}
            onChange={(n) =>
              setForm((s) => ({ ...s, z: { ...s.z, cMm: Math.max(0, n) } }))
            }
            min={0}
          />
        </div>
      </div>
    );
  }

  if (t === "custom") {
    const c = form.custom;
    const n = Math.min(7, Math.max(2, c.segmentCount));
    return (
      <div className="space-y-4">
        <div className="max-w-xs space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Segment count</Label>
          <Select
            value={String(n)}
            onValueChange={(v) => {
              const next = Math.min(7, Math.max(2, parseInt(v, 10)));
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
              {[2, 3, 4, 5, 6, 7].map((x) => (
                <SelectItem key={x} value={String(x)}>
                  {x} segments
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          {Array.from({ length: n }, (_, i) => {
            const isLast = i === n - 1;
            return (
              <div key={`seg-${i}`} className={SEGMENT_DIM_BOX}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {isLast ? `Segment ${i + 1} (end)` : `Segment ${i + 1} — bend`}
                </p>
                {isLast ? (
                  <NumField
                    label={`Length (mm)`}
                    value={c.segmentsMm[i] ?? 0}
                    onChange={(v) =>
                      setForm((s) => {
                        const next = [...s.custom.segmentsMm];
                        while (next.length < 7) next.push(0);
                        next[i] = Math.max(0, v);
                        return { ...s, custom: { ...s.custom, segmentsMm: next } };
                      })
                    }
                    min={0}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <NumField
                      label={`Segment ${i + 1} (mm)`}
                      value={c.segmentsMm[i] ?? 0}
                      onChange={(v) =>
                        setForm((s) => {
                          const next = [...s.custom.segmentsMm];
                          while (next.length < 7) next.push(0);
                          next[i] = Math.max(0, v);
                          return { ...s, custom: { ...s.custom, segmentsMm: next } };
                        })
                      }
                      min={0}
                    />
                    <NumField
                      label={`Angle after (${i + 1}) (°)`}
                      value={c.anglesDeg[i] ?? 180}
                      onChange={(v) =>
                        setForm((s) => {
                          const next = [...s.custom.anglesDeg];
                          while (next.length < 6) next.push(180);
                          next[i] = v;
                          return { ...s, custom: { ...s.custom, anglesDeg: next } };
                        })
                      }
                      step={0.1}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
