"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  LayoutGrid,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Ruler,
  Save,
  Trash2,
  Weight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { t } from "@/lib/i18n";
import { type MaterialType } from "@/types/materials";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { defaultMaterialGradeForFamily } from "../lib/plateFields";
import {
  normalizeFinishFromImport,
  phase2DefaultFinish,
  selectOptionsWithCurrent,
} from "../lib/materialSettingsOptions";
import type {
  BendPlateFormState,
  BendPlateQuoteItem,
  BendPlateCalculation,
  BendTemplateId,
  BendSegmentHole,
  BendSegmentHoleKind,
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
import { BEND_TEMPLATE_CARD_ORDER } from "./bendTemplateCardOrder";
import {
  getBendEditorBasicDataIssueCodes,
  getBendEditorValidationIssueCodes,
} from "./bendEditorValidation";
import { MethodPhaseMetricStrip } from "../components/method-phases/MethodPhaseMetricStrip";
import { BendTemplatePickerGlyph } from "./BendTemplateShapeGlyph";
import { ProfilePreview2D } from "./ProfilePreview2D";
import { ProfilePreview3D } from "./ProfilePreview3D";
import { SegmentFacePreview2D } from "./SegmentFacePreview2D";
import { SegmentHoleDimGuidePopover } from "./SegmentHoleDimGuidePopover";
import type { SegmentFaceDimEdge } from "./SegmentFaceKonvaHolesOverlay";
import { computeSegmentFaceSvgModel } from "./segmentFaceLayout";
import {
  clampAndSnapHoleCenterTo1Mm,
  resolvedOvalLengthMm,
  segmentFaceEffectiveWidthMm,
} from "./segmentFaceHolesBounds";
import { reclampSegmentHolesToFace } from "./SegmentFaceKonvaHolesOverlay";

const BP = "quote.bendPlatePhase";
const ED = `${BP}.editor`;

const SEGMENT_DIM_BOX =
  "rounded-xl border-0 bg-white/[0.03] p-3 space-y-3";

/** Bent-plate editor right panel cards (dark sidebar). */
const EDITOR_PANEL_CARD =
  "border border-white/[0.08] bg-card/50 shadow-none";
const EDITOR_CARD_TITLE = "text-sm font-semibold leading-tight text-foreground";

const TEMPLATE_IDS: BendTemplateId[] = ["l", "u", "z", "omega", "gutter", "plate", "custom"];

function templateLabel(id: BendTemplateId): string {
  return t(`${BP}.template.${id}.name`);
}

/** Hub / labels: legacy PlateFinish codes → i18n; settings Hebrew strings pass through. */
function bendPlateFinishDisplay(finish: string): string {
  if (finish === "carbon" || finish === "galvanized" || finish === "paint") {
    return t(`quote.finishLabels.${finish}`);
  }
  return finish;
}

function bendEditorBasicDataValidationMessages(form: BendPlateFormState): string[] {
  return getBendEditorBasicDataIssueCodes(form).map((code) => t(`${BP}.issues.${code}`));
}

function segmentHoleSummaryLine(h: BendSegmentHole): string {
  if (h.kind === "round") {
    return `${formatDecimal(h.diameterMm, 1)} מ״מ`;
  }
  if (h.kind === "oval") {
    return `${formatDecimal(h.diameterMm, 1)} · ${formatDecimal(resolvedOvalLengthMm(h), 1)} מ״מ`;
  }
  return `${formatDecimal(h.rectLengthMm ?? 0, 1)}×${formatDecimal(h.rectWidthMm ?? 0, 1)} מ״מ`;
}

function bendHoleWithNewKind(
  h: BendSegmentHole,
  kind: BendSegmentHoleKind
): BendSegmentHole {
  const { id, uMm, vMm } = h;
  if (kind === "round") {
    const d = Math.max(0, h.diameterMm > 0 ? h.diameterMm : 10);
    return { id, kind: "round", uMm, vMm, diameterMm: d };
  }
  if (kind === "oval") {
    const d = Math.max(0, h.diameterMm > 0 ? h.diameterMm : 10);
    const ovalLen = Math.max(
      resolvedOvalLengthMm({ ...h, kind: "oval", diameterMm: d }),
      d
    );
    return {
      id,
      kind: "oval",
      uMm,
      vMm,
      diameterMm: d,
      ovalLengthMm: ovalLen,
      rotationDeg: h.rotationDeg ?? 0,
    };
  }
  return {
    id,
    kind: "rect",
    uMm,
    vMm,
    diameterMm: 0,
    rectLengthMm: Math.max(0, h.rectLengthMm ?? 20),
    rectWidthMm: Math.max(0, h.rectWidthMm ?? 15),
    rotationDeg: h.rotationDeg ?? 0,
  };
}

function bendEditorValidationMessages(form: BendPlateFormState): string[] {
  return getBendEditorValidationIssueCodes(form).map((code) => {
    if (code.startsWith("customLen:")) {
      const i = Number.parseInt(code.slice("customLen:".length), 10);
      return t(`${BP}.issues.customLen`, { n: Number.isFinite(i) ? i + 1 : 1 });
    }
    if (code.startsWith("customTurn:")) {
      const i = Number.parseInt(code.slice("customTurn:".length), 10);
      return t(`${BP}.issues.customTurn`, { n: Number.isFinite(i) ? i + 1 : 1 });
    }
    return t(`${BP}.issues.${code}`);
  });
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
        className="h-9 tabular-nums text-sm"
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
    bendAngleSemantic: state.template === "custom" ? "path_turn" : "internal",
    template: state.template,
    global: { ...state.global },
    l: { ...state.l },
    u: { ...state.u },
    z: { ...state.z },
    omega: { ...state.omega },
    gutter: { ...state.gutter },
    plate: { ...state.plate },
    custom: {
      segmentCount: state.custom.segmentCount,
      segmentsMm: [...state.custom.segmentsMm],
      anglesDeg: [...state.custom.anglesDeg],
    },
    segmentFaceHoles: (state.segmentFaceHoles ?? []).map((row) =>
      (row ?? []).map((h) => ({ ...h }))
    ),
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

/** Fill parent (Quick Quote step 2 method setup uses flex-1 min-h-0). */
const BEND_PLATE_FILL =
  "flex h-full min-h-0 w-full max-h-full flex-col overflow-hidden";

const BEND_HUB_VIEWPORT = "flex h-full min-h-0 max-h-full flex-col";

interface BendPlateBuilderProps {
  materialType: MaterialType;
  quoteItems: BendPlateQuoteItem[];
  onAddItem: (item: BendPlateQuoteItem) => void;
  onUpdateItem: (item: BendPlateQuoteItem) => void;
  onRemoveItem: (id: string) => void;
  onResetAll: () => void;
  /** Return to the quote method step. */
  onBack: () => void;
  /** Finish this phase and return to the quote method step (e.g. after validation). */
  onComplete: () => void;
  /**
   * When set on mount, opens the shape editor immediately for this template
   * (e.g. plate-project template cards).
   */
  initialEditorTemplate?: BendTemplateId | null;
}

export function BendPlateBuilder({
  materialType,
  quoteItems,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onResetAll,
  onBack,
  onComplete,
  initialEditorTemplate = null,
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
          finish: phase2DefaultFinish(materialType),
        },
      };
    });
    setScreen("editor");
  }, [materialType]);

  const initialEditorOpenedRef = useRef(false);
  useLayoutEffect(() => {
    if (!initialEditorTemplate || initialEditorOpenedRef.current) return;
    initialEditorOpenedRef.current = true;
    openNewEditor(initialEditorTemplate);
  }, [initialEditorTemplate, openNewEditor]);

  const openEditEditor = useCallback(
    (item: BendPlateQuoteItem) => {
      setEditingId(item.id);
      setForm(() => {
        const next = formStateFromQuoteItem(item, materialType);
        return {
          ...next,
          global: {
            ...next.global,
            material: next.global.material || defaultMaterialGradeForFamily(materialType),
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
        materialType={materialType}
        form={form}
        setForm={setForm}
        pts={pts}
        profileSegmentDims={profileSegmentDims}
        profileBendAnglesDeg={profileBendAnglesDeg}
        patchGlobal={patchGlobal}
        basicDataInitiallySaved={editingId != null}
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
      onResetAll={onResetAll}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}

function BendPlateHub({
  quoteItems,
  hubMetrics,
  onSelectTemplate,
  onEdit,
  onRemove,
  onResetAll,
  onBack,
  onComplete,
}: {
  quoteItems: BendPlateQuoteItem[];
  hubMetrics: ReturnType<typeof aggregateMetrics>;
  onSelectTemplate: (id: BendTemplateId) => void;
  onEdit: (item: BendPlateQuoteItem) => void;
  onRemove: (id: string) => void;
  onResetAll: () => void;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [hubValidationOpen, setHubValidationOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const primaryDisabled = quoteItems.length === 0;
  const canReset = quoteItems.length > 0;

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

  function handleResetClick() {
    setResetConfirmOpen(true);
  }

  function confirmResetSession() {
    setResetConfirmOpen(false);
    onResetAll();
  }

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-0", BEND_HUB_VIEWPORT)} dir="rtl">
      <div className="flex min-h-0 min-w-0 flex-1 gap-0">
        <aside className="flex h-full min-h-0 w-full max-w-[min(336px,33.6vw)] shrink-0 flex-col border-e border-white/[0.08] bg-card/60">
          <div className="shrink-0 space-y-2 px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
            <h1 className="text-xl font-semibold text-foreground leading-snug">
              {t(`${BP}.sidebarTitle`)}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{t(`${BP}.sidebarIntro`)}</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col divide-y divide-white/[0.06]">
            <MethodPhaseMetricStrip
              icon={Package}
              label={t("methodMetrics.quantity")}
              value={formatInteger(hubMetrics.totalQty)}
            />
            <MethodPhaseMetricStrip
              icon={LayoutGrid}
              label={t("methodMetrics.area")}
              value={formatDecimal(hubMetrics.totalAreaM2, 2)}
              valueUnit={t("methodMetrics.unitM2")}
            />
            <MethodPhaseMetricStrip
              icon={Weight}
              label={t("methodMetrics.weight")}
              value={formatDecimal(hubMetrics.totalWeightKg, 1)}
              valueUnit={t("methodMetrics.unitKg")}
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <div
            id="quick-quote-method-scroll"
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-auto overscroll-contain"
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
              {quoteItems.length === 0 ? (
                <div className="flex min-h-[min(320px,50vh)] flex-col items-center justify-center gap-4 py-8">
                  <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
                    {t(`${BP}.emptyState`)}
                  </p>
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      size="default"
                      className="gap-2"
                      onClick={() => setShapePickerOpen(true)}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      {t(`${BP}.addPart`)}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="max-h-[min(70vh,800px)] overflow-auto rounded-md border border-white/[0.08] bg-card">
                    <Table
                      className="border-separate border-spacing-0"
                      containerClassName="overflow-visible"
                    >
                      <TableHeader className="sticky top-0 z-30 isolate border-b border-border bg-card shadow-[0_1px_0_0_hsl(var(--border))] [&_th]:bg-card [&_th:first-child]:rounded-ss-md [&_th:last-child]:rounded-se-md [&_tr]:border-b-0">
                        <TableRow className="border-b-0 hover:bg-transparent">
                          <TableHead
                            className={cn(
                              "min-w-[3.5rem] sticky top-0 right-0 z-40 bg-card py-2 pe-3 ps-3 text-center text-xs font-medium shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.35)]"
                            )}
                          >
                            {t(`${BP}.colIndex`)}
                          </TableHead>
                          <TableHead className="min-w-[72px] py-2 pe-3 ps-3 text-xs font-medium">
                            {t(`${BP}.colShape`)}
                          </TableHead>
                          <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
                            {t(`${BP}.colThickness`)}
                          </TableHead>
                          <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
                            {t(`${BP}.colWidth`)}
                          </TableHead>
                          <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
                            {t(`${BP}.colLength`)}
                          </TableHead>
                          <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
                            {t(`${BP}.colQuantity`)}
                          </TableHead>
                          <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
                            {t(`${BP}.colArea`)}
                          </TableHead>
                          <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
                            {t(`${BP}.colWeight`)}
                          </TableHead>
                          <TableHead className="min-w-[120px] py-2 pe-3 ps-3 text-xs font-medium">
                            {t(`${BP}.colMaterial`)}
                          </TableHead>
                          <TableHead className="min-w-[100px] py-2 pe-3 ps-3 text-xs font-medium">
                            {t(`${BP}.colFinish`)}
                          </TableHead>
                          <TableHead className="min-w-[4.5rem] py-2 pe-3 ps-3 text-center text-xs font-medium">
                            {t(`${BP}.colEdit`)}
                          </TableHead>
                          <TableHead className="min-w-[4.5rem] py-2 pe-3 ps-3 text-center text-xs font-medium">
                            {t(`${BP}.colDelete`)}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quoteItems.map((it, index) => {
                          const q = Math.max(0, Math.floor(it.global.quantity) || 0);
                          const lineArea = it.calc.areaM2 * q;
                          return (
                            <TableRow key={it.id} className="group/row">
                              <TableCell
                                className={cn(
                                  "sticky right-0 z-20 bg-card py-2 pe-3 ps-3 text-center text-sm tabular-nums text-muted-foreground shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.25)]",
                                  "group-hover/row:bg-white/[0.04]"
                                )}
                              >
                                {index + 1}
                              </TableCell>
                              <TableCell className="py-2 pe-3 ps-3 text-sm font-medium tabular-nums">
                                {templateLabel(it.template)}
                              </TableCell>
                              <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                                {formatDecimal(it.global.thicknessMm, 2)}
                              </TableCell>
                              <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                                {formatDecimal(it.calc.blankWidthMm, 1)}
                              </TableCell>
                              <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                                {formatDecimal(it.calc.blankLengthMm, 1)}
                              </TableCell>
                              <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                                {formatInteger(q)}
                              </TableCell>
                              <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                                {formatDecimal(lineArea, 3)}
                              </TableCell>
                              <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                                {formatDecimal(it.calc.weightKg, 2)}
                              </TableCell>
                              <TableCell className="py-2 pe-3 ps-3 text-sm text-muted-foreground max-w-[180px] truncate">
                                {it.global.material || "—"}
                              </TableCell>
                              <TableCell className="py-2 pe-3 ps-3 text-sm text-muted-foreground whitespace-nowrap">
                                {bendPlateFinishDisplay(it.global.finish)}
                              </TableCell>
                              <TableCell className="py-2 pe-2 ps-2">
                                <div className="flex justify-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label={t(`${BP}.editRowAria`)}
                                    onClick={() => onEdit(it)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="py-2 pe-2 ps-2">
                                <div className="flex justify-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    aria-label={t(`${BP}.deleteRowAria`)}
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
                  <div className="mt-4 flex justify-start" dir="rtl">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="inline-flex shrink-0 gap-1.5"
                      onClick={() => setShapePickerOpen(true)}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      {t(`${BP}.addPart`)}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="shrink-0 border-t border-white/[0.08] bg-card/60 px-4 py-3 sm:px-5"
        dir="ltr"
      >
        <div className="flex flex-wrap items-center justify-start gap-2">
          <Button
            type="button"
            className="gap-2"
            disabled={primaryDisabled}
            onClick={handleHubCompleteClick}
          >
            <Check className="h-4 w-4" aria-hidden />
            {t(`${BP}.complete`)}
          </Button>
          <Button type="button" variant="outline" className="inline-flex flex-row gap-2" onClick={onBack}>
            <span>{t(`${BP}.back`)}</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleResetClick}
            disabled={!canReset}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t(`${BP}.reset`)}
          </Button>
        </div>
      </div>

      <Dialog open={shapePickerOpen} onOpenChange={setShapePickerOpen}>
        <DialogContent
          className={cn(
            "flex w-[calc(100vw-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden border-white/10 bg-card p-0 sm:rounded-xl"
          )}
          dir="rtl"
          showCloseButton={false}
        >
          <div className="shrink-0 border-b border-white/10 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
            <DialogHeader className="sm:text-start gap-2 space-y-0">
              <DialogTitle className="text-base sm:text-lg">{t(`${BP}.shapePickerTitle`)}</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {t(`${BP}.shapePickerDescription`)}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div dir="ltr" className="w-full shrink-0 overflow-hidden border-t border-solid border-[#6A23F7]/20">
            <div
              className={cn(
                "grid w-full min-h-[21rem] grid-cols-2 sm:min-h-[22.5rem]",
                "[grid-template-rows:repeat(4,minmax(0,1fr))]"
              )}
            >
              {BEND_TEMPLATE_CARD_ORDER.map((tid, i) => (
                <button
                  key={tid}
                  type="button"
                  dir="rtl"
                  onClick={() => pickShape(tid)}
                  className={cn(
                    "flex min-h-0 min-w-0 flex-col items-center justify-center gap-3 px-4 py-4 text-center transition-colors",
                    i === BEND_TEMPLATE_CARD_ORDER.length - 1 && "col-span-2",
                    "bg-card hover:bg-white/[0.03]",
                    "border-b border-solid border-[#6A23F7]/20",
                    i % 2 === 0 && "border-s border-e border-solid border-[#6A23F7]/20",
                    i % 2 === 1 && "border-e border-solid border-[#6A23F7]/20",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    "active:bg-white/[0.05]"
                  )}
                >
                  <div
                    className="flex min-h-[3.75rem] w-full shrink-0 items-center justify-center"
                    aria-hidden
                  >
                    <BendTemplatePickerGlyph
                      id={tid}
                      className="h-9 w-[4.25rem] shrink-0"
                    />
                  </div>
                  <span className="block w-full text-center text-base font-bold leading-tight tracking-tight text-foreground sm:text-lg">
                    {templateLabel(tid)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={hubValidationOpen} onOpenChange={setHubValidationOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl" showCloseButton={false}>
          <DialogHeader className="sm:text-start">
            <DialogTitle>{t(`${BP}.hubValidationTitle`)}</DialogTitle>
            <DialogDescription>{t(`${BP}.hubValidationDescription`)}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start">
            <Button type="button" onClick={() => setHubValidationOpen(false)}>
              {t(`${BP}.hubValidationOk`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl" showCloseButton={false}>
          <DialogHeader className="sm:text-start">
            <DialogTitle>{t(`${BP}.confirmResetTitle`)}</DialogTitle>
            <DialogDescription>{t(`${BP}.confirmResetDescription`)}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start sm:gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => setResetConfirmOpen(false)}>
              {t(`${BP}.cancel`)}
            </Button>
            <Button type="button" onClick={confirmResetSession}>
              {t(`${BP}.confirmResetAction`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BendPlateShapeEditor({
  materialType,
  form,
  setForm,
  pts,
  profileSegmentDims,
  profileBendAnglesDeg,
  patchGlobal,
  basicDataInitiallySaved,
  onComplete,
  onCancel,
}: {
  materialType: MaterialType;
  form: BendPlateFormState;
  setForm: Dispatch<SetStateAction<BendPlateFormState>>;
  pts: Point2[];
  profileSegmentDims: ReturnType<typeof bendProfileDimensionSegments>;
  profileBendAnglesDeg: ReturnType<typeof bendProfileBendAngles>;
  patchGlobal: (patch: Partial<BendPlateFormState["global"]>) => void;
  /** When editing an existing row, basic data is treated as already saved. */
  basicDataInitiallySaved: boolean;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const resetTemplateShape = useCallback(() => {
    setForm((s) => {
      const d = createDefaultBendPlateFormState();
      switch (s.template) {
        case "l":
          return { ...s, l: { ...d.l }, segmentFaceHoles: [] };
        case "u":
          return { ...s, u: { ...d.u }, segmentFaceHoles: [] };
        case "z":
          return { ...s, z: { ...d.z }, segmentFaceHoles: [] };
        case "omega":
          return { ...s, omega: { ...d.omega }, segmentFaceHoles: [] };
        case "gutter":
          return { ...s, gutter: { ...d.gutter }, segmentFaceHoles: [] };
        case "plate":
          return { ...s, plate: { ...d.plate }, segmentFaceHoles: [] };
        case "custom":
          return { ...s, custom: { ...d.custom }, segmentFaceHoles: [] };
        default:
          return s;
      }
    });
  }, [setForm]);

  const [preview3dOpen, setPreview3dOpen] = useState(false);
  const [saveValidationOpen, setSaveValidationOpen] = useState(false);
  const [saveValidationLines, setSaveValidationLines] = useState<string[]>([]);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  /** `null` = side profile; index = flat face of that straight segment (hole placement). */
  const [holeViewSegmentIndex, setHoleViewSegmentIndex] = useState<number | null>(null);
  /** Perforations panel: which row is expanded — existing hole id, or "new" draft at list end. */
  const [holePanelExpand, setHolePanelExpand] = useState<
    null | { type: "new" } | { type: "hole"; id: string }
  >(null);
  /** Canvas: click a guide line to type exact distance (mm) from hole center to that edge. */
  const [holeDimPopover, setHoleDimPopover] = useState<null | {
    holeId: string;
    edge: SegmentFaceDimEdge;
    anchor: { left: number; top: number };
  }>(null);
  /** Dashed edge guides only after the user taps this hole on the face canvas (not sidebar-only). */
  const [segmentFaceCanvasGuidesHoleId, setSegmentFaceCanvasGuidesHoleId] =
    useState<string | null>(null);
  /** Shown above a hole after adding it until the user taps a hole on the canvas or changes focus. */
  const [holePlacementTooltipHoleId, setHolePlacementTooltipHoleId] = useState<
    string | null
  >(null);
  const canvasFaceWrapRef = useRef<HTMLDivElement>(null);
  const [segmentHoleKind, setSegmentHoleKind] = useState<BendSegmentHoleKind>("round");
  const [holeDraftDiameterMm, setHoleDraftDiameterMm] = useState(10);
  const [holeDraftOvalLengthMm, setHoleDraftOvalLengthMm] = useState(40);
  const [holeDraftOvalRotationDeg, setHoleDraftOvalRotationDeg] = useState(0);
  const [holeDraftRectLengthMm, setHoleDraftRectLengthMm] = useState(20);
  const [holeDraftRectWidthMm, setHoleDraftRectWidthMm] = useState(15);
  const [holeDraftRectRotationDeg, setHoleDraftRectRotationDeg] = useState(0);
  type EditorSidebarScreen = "hub" | "basic" | "dimensions" | "perforations";
  const [editorSidebarScreen, setEditorSidebarScreen] =
    useState<EditorSidebarScreen>("hub");
  const [basicDataSaved, setBasicDataSaved] = useState(basicDataInitiallySaved);

  const perforationsAvailable =
    form.template !== "plate" && profileSegmentDims.length > 0;

  const basicDataGateOk = basicDataSaved;

  const closeEditorSection = useCallback(() => {
    setEditorSidebarScreen("hub");
  }, []);

  const saveBasicDataSection = useCallback(() => {
    const codes = getBendEditorBasicDataIssueCodes(form);
    if (codes.length > 0) {
      setSaveValidationLines(bendEditorBasicDataValidationMessages(form));
      setSaveValidationOpen(true);
      return;
    }
    setBasicDataSaved(true);
    setEditorSidebarScreen("hub");
  }, [form]);

  useEffect(() => {
    if (!perforationsAvailable && editorSidebarScreen === "perforations") {
      setEditorSidebarScreen("hub");
    }
  }, [perforationsAvailable, editorSidebarScreen]);

  useEffect(() => {
    if (
      !basicDataGateOk &&
      (editorSidebarScreen === "dimensions" || editorSidebarScreen === "perforations")
    ) {
      setEditorSidebarScreen("hub");
    }
  }, [basicDataGateOk, editorSidebarScreen]);

  const materialConfig = useMemo(() => getMaterialConfig(materialType), [materialType]);

  const profileSegmentLensKey = useMemo(
    () => profileSegmentDims.map((s) => s.lengthMm).join(","),
    [profileSegmentDims]
  );
  const profileSegmentDimsRef = useRef(profileSegmentDims);
  profileSegmentDimsRef.current = profileSegmentDims;

  useEffect(() => {
    const n = profileSegmentDims.length;
    setForm((s) => {
      const rows = s.segmentFaceHoles ?? [];
      if (rows.length <= n) return s;
      return { ...s, segmentFaceHoles: rows.slice(0, n) };
    });
  }, [profileSegmentDims.length, setForm]);

  useEffect(() => {
    setForm((s) => {
      const rows = s.segmentFaceHoles ?? [];
      if (rows.length === 0) return s;
      const dims = profileSegmentDimsRef.current;
      let changed = false;
      const next = rows.map((row, segIdx) => {
        const seg = dims[segIdx];
        const r = row ?? [];
        if (!seg || r.length === 0) return row ?? [];
        const layout = computeSegmentFaceSvgModel(
          seg.lengthMm,
          s.global.plateWidthMm,
          seg.label
        );
        if (layout.kind !== "ok") return row ?? [];
        const nr = reclampSegmentHolesToFace(
          r,
          layout.plateWidthMm,
          layout.segmentLenMm,
          layout.plateWidthDrawMm
        );
        for (let i = 0; i < nr.length; i++) {
          const a = r[i];
          const b = nr[i];
          if (!a || !b || a.uMm !== b.uMm || a.vMm !== b.vMm) {
            changed = true;
            break;
          }
        }
        return nr;
      });
      return changed ? { ...s, segmentFaceHoles: next } : s;
    });
  }, [form.global.plateWidthMm, profileSegmentLensKey, setForm]);

  const addSegmentHole = useCallback(() => {
    if (holeViewSegmentIndex === null) return;
    const seg = profileSegmentDims[holeViewSegmentIndex];
    if (!seg) return;
    const layout = computeSegmentFaceSvgModel(
      seg.lengthMm,
      form.global.plateWidthMm,
      seg.label
    );
    if (layout.kind !== "ok") return;
    const W = segmentFaceEffectiveWidthMm(
      layout.plateWidthMm,
      layout.segmentLenMm,
      layout.plateWidthDrawMm
    );
    const L = layout.segmentLenMm;

    const id = nanoid();
    let hole: BendSegmentHole;
    if (segmentHoleKind === "round") {
      hole = {
        id,
        kind: "round",
        diameterMm: Math.max(0, holeDraftDiameterMm),
        uMm: W / 2,
        vMm: L / 2,
      };
    } else if (segmentHoleKind === "oval") {
      hole = {
        id,
        kind: "oval",
        diameterMm: Math.max(0, holeDraftDiameterMm),
        ovalLengthMm: Math.max(holeDraftOvalLengthMm, holeDraftDiameterMm),
        rotationDeg: holeDraftOvalRotationDeg,
        uMm: W / 2,
        vMm: L / 2,
      };
    } else {
      hole = {
        id,
        kind: "rect",
        diameterMm: 0,
        rectLengthMm: Math.max(0, holeDraftRectLengthMm),
        rectWidthMm: Math.max(0, holeDraftRectWidthMm),
        rotationDeg: holeDraftRectRotationDeg,
        uMm: W / 2,
        vMm: L / 2,
      };
    }
    const [u, v] = clampAndSnapHoleCenterTo1Mm(hole.uMm, hole.vMm, hole, W, L);
    hole = { ...hole, uMm: u, vMm: v };

    const idx = holeViewSegmentIndex;
    setForm((s) => {
      const rows = [...(s.segmentFaceHoles ?? [])];
      while (rows.length <= idx) rows.push([]);
      rows[idx] = [...(rows[idx] ?? []), hole];
      return { ...s, segmentFaceHoles: rows };
    });
    setHolePanelExpand({ type: "hole", id });
    setHolePlacementTooltipHoleId(id);
  }, [
    holeViewSegmentIndex,
    profileSegmentDims,
    form.global.plateWidthMm,
    segmentHoleKind,
    holeDraftDiameterMm,
    holeDraftOvalLengthMm,
    holeDraftOvalRotationDeg,
    holeDraftRectLengthMm,
    holeDraftRectWidthMm,
    holeDraftRectRotationDeg,
    setForm,
  ]);

  const patchSegmentHole = useCallback(
    (holeId: string, patch: Partial<BendSegmentHole>) => {
      const segIdx = holeViewSegmentIndex;
      if (segIdx === null) return;
      setForm((s) => {
        const seg = profileSegmentDims[segIdx];
        if (!seg) return s;
        const layout = computeSegmentFaceSvgModel(
          seg.lengthMm,
          s.global.plateWidthMm,
          seg.label
        );
        if (layout.kind !== "ok") return s;
        const W = segmentFaceEffectiveWidthMm(
          layout.plateWidthMm,
          layout.segmentLenMm,
          layout.plateWidthDrawMm
        );
        const L = layout.segmentLenMm;
        const rows = [...(s.segmentFaceHoles ?? [])];
        const row = [...(rows[segIdx] ?? [])];
        const j = row.findIndex((h) => h.id === holeId);
        if (j < 0) return s;
        let next: BendSegmentHole = { ...row[j], ...patch };
        const [u, v] = clampAndSnapHoleCenterTo1Mm(next.uMm, next.vMm, next, W, L);
        next = { ...next, uMm: u, vMm: v };
        row[j] = next;
        rows[segIdx] = row;
        return { ...s, segmentFaceHoles: rows };
      });
    },
    [holeViewSegmentIndex, profileSegmentDims, setForm]
  );

  const replaceSegmentHole = useCallback(
    (holeId: string, nextHole: BendSegmentHole) => {
      const segIdx = holeViewSegmentIndex;
      if (segIdx === null) return;
      setForm((s) => {
        const seg = profileSegmentDims[segIdx];
        if (!seg) return s;
        const layout = computeSegmentFaceSvgModel(
          seg.lengthMm,
          s.global.plateWidthMm,
          seg.label
        );
        if (layout.kind !== "ok") return s;
        const W = segmentFaceEffectiveWidthMm(
          layout.plateWidthMm,
          layout.segmentLenMm,
          layout.plateWidthDrawMm
        );
        const L = layout.segmentLenMm;
        const rows = [...(s.segmentFaceHoles ?? [])];
        const row = [...(rows[segIdx] ?? [])];
        const j = row.findIndex((h) => h.id === holeId);
        if (j < 0) return s;
        let next = { ...nextHole, id: holeId };
        const [u, v] = clampAndSnapHoleCenterTo1Mm(next.uMm, next.vMm, next, W, L);
        next = { ...next, uMm: u, vMm: v };
        row[j] = next;
        rows[segIdx] = row;
        return { ...s, segmentFaceHoles: rows };
      });
    },
    [holeViewSegmentIndex, profileSegmentDims, setForm]
  );

  const deleteSegmentHole = useCallback(
    (holeId: string) => {
      const segIdx = holeViewSegmentIndex;
      if (segIdx === null) return;
      setForm((s) => {
        const rows = [...(s.segmentFaceHoles ?? [])];
        const row = (rows[segIdx] ?? []).filter((h) => h.id !== holeId);
        rows[segIdx] = row;
        return { ...s, segmentFaceHoles: rows };
      });
      setHolePanelExpand((exp) =>
        exp?.type === "hole" && exp.id === holeId ? null : exp
      );
      setSegmentFaceCanvasGuidesHoleId((g) => (g === holeId ? null : g));
      setHolePlacementTooltipHoleId((t) => (t === holeId ? null : t));
    },
    [holeViewSegmentIndex, setForm]
  );

  const handleSegmentHolePositionChange = useCallback(
    (holeId: string, uMm: number, vMm: number) => {
      const idx = holeViewSegmentIndex;
      if (idx === null) return;
      setHolePanelExpand({ type: "hole", id: holeId });
      setForm((s) => {
        const rows = [...(s.segmentFaceHoles ?? [])];
        const row = [...(rows[idx] ?? [])];
        const j = row.findIndex((h) => h.id === holeId);
        if (j < 0) return s;
        row[j] = { ...row[j], uMm, vMm };
        rows[idx] = row;
        return { ...s, segmentFaceHoles: rows };
      });
    },
    [holeViewSegmentIndex, setForm]
  );

  const handleCanvasHoleSelect = useCallback((holeId: string) => {
    setHolePanelExpand({ type: "hole", id: holeId });
    setSegmentFaceCanvasGuidesHoleId(holeId);
    setHolePlacementTooltipHoleId(null);
  }, []);

  const handleDimensionGuideLineClick = useCallback(
    (holeId: string, edge: SegmentFaceDimEdge, clientX: number, clientY: number) => {
      const el = canvasFaceWrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setHoleDimPopover({
        holeId,
        edge,
        anchor: { left: clientX - r.left, top: clientY - r.top },
      });
    },
    []
  );

  const handleHoleDimGuideApply = useCallback(
    (mm: number) => {
      const pop = holeDimPopover;
      if (!pop || holeViewSegmentIndex === null) return;
      const idx = holeViewSegmentIndex;
      const seg = profileSegmentDims[idx];
      if (!seg) return;
      const hole = form.segmentFaceHoles?.[idx]?.find((h) => h.id === pop.holeId);
      if (!hole) return;
      const layout = computeSegmentFaceSvgModel(
        seg.lengthMm,
        form.global.plateWidthMm,
        seg.label
      );
      if (layout.kind !== "ok") return;
      const W = segmentFaceEffectiveWidthMm(
        layout.plateWidthMm,
        layout.segmentLenMm,
        layout.plateWidthDrawMm
      );
      const L = layout.segmentLenMm;
      let u = hole.uMm;
      let v = hole.vMm;
      switch (pop.edge) {
        case "left":
          u = mm;
          break;
        case "right":
          u = W - mm;
          break;
        case "top":
          v = mm;
          break;
        case "bottom":
          v = L - mm;
          break;
      }
      const [uc, vc] = clampAndSnapHoleCenterTo1Mm(u, v, hole, W, L);
      handleSegmentHolePositionChange(pop.holeId, uc, vc);
      setHoleDimPopover(null);
    },
    [
      holeDimPopover,
      holeViewSegmentIndex,
      profileSegmentDims,
      form.segmentFaceHoles,
      form.global.plateWidthMm,
      handleSegmentHolePositionChange,
    ]
  );

  useEffect(() => {
    if (holePanelExpand?.type !== "hole") setHoleDimPopover(null);
  }, [holePanelExpand]);

  useEffect(() => {
    setSegmentFaceCanvasGuidesHoleId(null);
    setHolePlacementTooltipHoleId(null);
  }, [holeViewSegmentIndex]);

  useEffect(() => {
    if (holePlacementTooltipHoleId === null) return;
    const match =
      holePanelExpand?.type === "hole" &&
      holePanelExpand.id === holePlacementTooltipHoleId;
    if (!match) setHolePlacementTooltipHoleId(null);
  }, [holePanelExpand, holePlacementTooltipHoleId]);

  useEffect(() => {
    if (holePlacementTooltipHoleId === null) return;
    const id = window.setTimeout(() => {
      setHolePlacementTooltipHoleId(null);
    }, 5000);
    return () => window.clearTimeout(id);
  }, [holePlacementTooltipHoleId]);

  useEffect(() => {
    if (holeViewSegmentIndex === null) {
      setHolePanelExpand(null);
      return;
    }
    const row = form.segmentFaceHoles?.[holeViewSegmentIndex] ?? [];
    setHolePanelExpand((exp) => {
      if (exp?.type === "hole" && !row.some((h) => h.id === exp.id)) {
        return null;
      }
      return exp;
    });
  }, [holeViewSegmentIndex, form.segmentFaceHoles]);

  useEffect(() => {
    if (form.template === "plate") {
      setHoleViewSegmentIndex(null);
      return;
    }
    if (
      holeViewSegmentIndex !== null &&
      holeViewSegmentIndex >= profileSegmentDims.length
    ) {
      setHoleViewSegmentIndex(null);
    }
  }, [form.template, profileSegmentDims.length, holeViewSegmentIndex]);

  const gradeSelectValue =
    (form.global.material || "").trim() || defaultMaterialGradeForFamily(materialType);
  const finishSelectValue = normalizeFinishFromImport(
    materialType,
    form.global.finish,
    materialConfig
  );

  const handleSaveClick = useCallback(() => {
    const codes = getBendEditorValidationIssueCodes(form);
    if (codes.length > 0) {
      setSaveValidationLines(bendEditorValidationMessages(form));
      setSaveValidationOpen(true);
      return;
    }
    onComplete();
  }, [form, onComplete]);

  const handleBackClick = useCallback(() => {
    const codes = getBendEditorValidationIssueCodes(form);
    if (codes.length > 0) {
      setBackConfirmOpen(true);
      return;
    }
    onCancel();
  }, [form, onCancel]);

  const confirmBackDiscard = useCallback(() => {
    setBackConfirmOpen(false);
    onCancel();
  }, [onCancel]);

  const segmentFaceHoleRow =
    holeViewSegmentIndex !== null
      ? (form.segmentFaceHoles?.[holeViewSegmentIndex] ?? [])
      : [];
  const canvasSelectedHoleId =
    holePanelExpand?.type === "hole" ? holePanelExpand.id : null;

  const holeDimGuideInitialMm = useMemo(() => {
    if (!holeDimPopover || holeViewSegmentIndex === null) return 0;
    const seg = profileSegmentDims[holeViewSegmentIndex];
    if (!seg) return 0;
    const h = form.segmentFaceHoles?.[holeViewSegmentIndex]?.find(
      (x) => x.id === holeDimPopover.holeId
    );
    if (!h) return 0;
    const layout = computeSegmentFaceSvgModel(
      seg.lengthMm,
      form.global.plateWidthMm,
      seg.label
    );
    if (layout.kind !== "ok") return 0;
    const W = segmentFaceEffectiveWidthMm(
      layout.plateWidthMm,
      layout.segmentLenMm,
      layout.plateWidthDrawMm
    );
    const L = layout.segmentLenMm;
    switch (holeDimPopover.edge) {
      case "left":
        return h.uMm;
      case "right":
        return W - h.uMm;
      case "top":
        return h.vMm;
      case "bottom":
        return L - h.vMm;
      default:
        return 0;
    }
  }, [
    holeDimPopover,
    holeViewSegmentIndex,
    profileSegmentDims,
    form.segmentFaceHoles,
    form.global.plateWidthMm,
  ]);

  return (
    <div className={cn(BEND_PLATE_FILL)} dir="rtl">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <aside className="flex w-[min(100%,23.4375rem)] shrink-0 flex-col border-e border-white/[0.08] bg-card/60 sm:w-[min(100%,26.5625rem)]">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
              {editorSidebarScreen === "hub" ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                  <button
                    type="button"
                    className="group flex min-h-0 flex-1 basis-0 flex-col rounded-xl text-center outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={() => setEditorSidebarScreen("basic")}
                  >
                    <Card
                      className={cn(
                        EDITOR_PANEL_CARD,
                        "flex h-full min-h-0 flex-1 flex-col transition-colors group-hover:bg-white/[0.05]"
                      )}
                    >
                      <CardHeader className="flex flex-1 flex-col items-center justify-center gap-1.5 px-3 py-4 text-center sm:gap-2 sm:px-4">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-primary"
                          aria-hidden
                        >
                          <Package className="h-5 w-5" />
                        </span>
                        <CardTitle className={cn(EDITOR_CARD_TITLE, "text-center")}>
                          {t(`${ED}.cardBasicData`)}
                        </CardTitle>
                        <CardDescription className="text-center text-[10px] leading-snug sm:text-[11px] sm:leading-relaxed">
                          {t(`${ED}.cardBasicDataDescription`)}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </button>

                  <button
                    type="button"
                    disabled={!basicDataGateOk}
                    className={cn(
                      "group flex min-h-0 flex-1 basis-0 flex-col rounded-xl text-center outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      !basicDataGateOk && "cursor-not-allowed opacity-55"
                    )}
                    onClick={() => {
                      if (basicDataGateOk) setEditorSidebarScreen("dimensions");
                    }}
                  >
                    <Card
                      className={cn(
                        EDITOR_PANEL_CARD,
                        "flex h-full min-h-0 flex-1 flex-col",
                        basicDataGateOk &&
                          "transition-colors group-hover:bg-white/[0.05]"
                      )}
                    >
                      <CardHeader className="flex flex-1 flex-col items-center justify-center gap-1.5 px-3 py-4 text-center sm:gap-2 sm:px-4">
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]",
                            basicDataGateOk ? "text-primary" : "text-muted-foreground"
                          )}
                          aria-hidden
                        >
                          <Ruler className="h-5 w-5" />
                        </span>
                        <CardTitle className={cn(EDITOR_CARD_TITLE, "text-center")}>
                          {t(`${ED}.cardDimensions`)}
                        </CardTitle>
                        <CardDescription className="text-center text-[10px] leading-snug sm:text-[11px] sm:leading-relaxed">
                          {basicDataGateOk
                            ? t(`${ED}.cardDimensionsDescription`)
                            : t(`${ED}.cardLockedUntilBasicSaved`)}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </button>

                  <button
                    type="button"
                    disabled={!perforationsAvailable || !basicDataGateOk}
                    className={cn(
                      "group flex min-h-0 flex-1 basis-0 flex-col rounded-xl text-center outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      (!perforationsAvailable || !basicDataGateOk) &&
                        "cursor-not-allowed opacity-55"
                    )}
                    onClick={() => {
                      if (perforationsAvailable && basicDataGateOk) {
                        setEditorSidebarScreen("perforations");
                      }
                    }}
                  >
                    <Card
                      className={cn(
                        EDITOR_PANEL_CARD,
                        "flex h-full min-h-0 flex-1 flex-col",
                        perforationsAvailable &&
                          basicDataGateOk &&
                          "transition-colors group-hover:bg-white/[0.05]"
                      )}
                    >
                      <CardHeader className="flex flex-1 flex-col items-center justify-center gap-1.5 px-3 py-4 text-center sm:gap-2 sm:px-4">
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]",
                            perforationsAvailable && basicDataGateOk
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                          aria-hidden
                        >
                          <CircleDot className="h-5 w-5" />
                        </span>
                        <CardTitle className={cn(EDITOR_CARD_TITLE, "text-center")}>
                          {t(`${ED}.cardPerforations`)}
                        </CardTitle>
                        <CardDescription className="text-center text-[10px] leading-snug sm:text-[11px] sm:leading-relaxed">
                          {!perforationsAvailable
                            ? t(`${ED}.cardPerforationsUnavailable`)
                            : !basicDataGateOk
                              ? t(`${ED}.cardLockedUntilBasicSaved`)
                              : t(`${ED}.cardPerforationsDescription`)}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </button>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pb-2">
                    {editorSidebarScreen === "basic" ? (
                      <div className="space-y-3">
                        <h2 className="text-base font-semibold leading-tight">
                          {t(`${ED}.cardBasicData`)}
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                          <NumField
                            label={t(`${ED}.thicknessMm`)}
                            value={form.global.thicknessMm}
                            onChange={(n) => patchGlobal({ thicknessMm: Math.max(0, n) })}
                            min={0}
                            step={0.01}
                          />
                          {form.template !== "plate" ? (
                            <NumField
                              label={t(`${ED}.plateWidthMm`)}
                              value={form.global.plateWidthMm}
                              onChange={(n) => patchGlobal({ plateWidthMm: Math.max(0, n) })}
                              min={0}
                            />
                          ) : null}
                          <NumField
                            label={t(`${ED}.quantity`)}
                            value={form.global.quantity}
                            onChange={(n) =>
                              patchGlobal({
                                quantity: Math.max(
                                  0,
                                  Math.floor(Number.isFinite(n) ? n : 0)
                                ),
                              })
                            }
                            min={0}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground font-normal">
                              {t(`${ED}.materialGrade`)}
                            </Label>
                            <Select
                              value={gradeSelectValue}
                              onValueChange={(v) => patchGlobal({ material: v })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent dir="rtl">
                                {selectOptionsWithCurrent(
                                  materialConfig.enabledGrades,
                                  gradeSelectValue
                                ).map((g) => (
                                  <SelectItem key={g} value={g}>
                                    {g}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground font-normal">
                              {t(`${ED}.finish`)}
                            </Label>
                            <Select
                              value={finishSelectValue}
                              onValueChange={(v) => patchGlobal({ finish: v })}
                            >
                              <SelectTrigger className="h-9 max-w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent dir="rtl">
                                {selectOptionsWithCurrent(
                                  materialConfig.enabledFinishes,
                                  finishSelectValue
                                ).map((f) => (
                                  <SelectItem key={f} value={f}>
                                    {f}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {editorSidebarScreen === "dimensions" ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h2 className="text-base font-semibold leading-tight">
                            {t(`${ED}.cardDimensions`)}
                          </h2>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1.5"
                            onClick={resetTemplateShape}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {t(`${ED}.resetShape`)}
                          </Button>
                        </div>
                        {form.template === "custom" ? (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {t(`${ED}.templateDimsHintCustom`)}
                          </p>
                        ) : null}
                        <TemplateFields form={form} setForm={setForm} />
                      </div>
                    ) : null}

                    {editorSidebarScreen === "perforations" && perforationsAvailable ? (
                      <div className="space-y-3">
                        <h2 className="text-base font-semibold leading-tight">
                          {t(`${ED}.cardPerforations`)}
                        </h2>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {t(`${ED}.holesHint`)}
                        </p>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground font-normal">
                            {t(`${ED}.holesPickSegment`)}
                          </Label>
                          <Select
                            value={
                              holeViewSegmentIndex === null
                                ? "__profile__"
                                : String(holeViewSegmentIndex)
                            }
                            onValueChange={(v) => {
                              if (v === "__profile__") setHoleViewSegmentIndex(null);
                              else {
                                const i = Number.parseInt(v, 10);
                                setHoleViewSegmentIndex(Number.isFinite(i) ? i : null);
                              }
                            }}
                          >
                            <SelectTrigger className="h-9 max-w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value="__profile__">
                                {t(`${ED}.holesFullProfile`)}
                              </SelectItem>
                              {profileSegmentDims.map((seg, i) => (
                                <SelectItem key={`${seg.label}-${i}`} value={String(i)}>
                                  {t(`${ED}.holesSegmentOption`, {
                                    label: seg.label,
                                    length: formatDecimal(seg.lengthMm, 1),
                                  })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {holeViewSegmentIndex !== null ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-2">
                              <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {t(`${ED}.holesSavedListTitle`)}
                              </p>
                              <ul className="space-y-1.5 pe-0.5">
                                {segmentFaceHoleRow.map((h, i) => {
                                  const kindLabel =
                                    h.kind === "round"
                                      ? t(`${ED}.holesKindRound`)
                                      : h.kind === "oval"
                                        ? t(`${ED}.holesKindOval`)
                                        : t(`${ED}.holesKindRect`);
                                  const expanded =
                                    holePanelExpand?.type === "hole" &&
                                    holePanelExpand.id === h.id;
                                  const idx1 = i + 1;
                                  return (
                                    <li
                                      key={h.id}
                                      className="overflow-hidden rounded-lg border border-white/[0.1] bg-white/[0.02]"
                                    >
                                      <button
                                        type="button"
                                        className={cn(
                                          "flex w-full items-center gap-2 px-2.5 py-2 text-start transition-colors",
                                          expanded
                                            ? "bg-white/[0.06]"
                                            : "hover:bg-white/[0.04]"
                                        )}
                                        aria-expanded={expanded}
                                        onClick={() =>
                                          setHolePanelExpand((ex) =>
                                            ex?.type === "hole" && ex.id === h.id
                                              ? null
                                              : { type: "hole", id: h.id }
                                          )
                                        }
                                      >
                                        <ChevronDown
                                          className={cn(
                                            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                            expanded && "rotate-180"
                                          )}
                                          aria-hidden
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold tabular-nums">
                                              {idx1}
                                            </span>
                                            <span className="truncate text-[11px] text-muted-foreground">
                                              {kindLabel}
                                            </span>
                                          </div>
                                          <span className="mt-0.5 block truncate text-[10px] tabular-nums text-muted-foreground/90">
                                            {segmentHoleSummaryLine(h)}
                                          </span>
                                        </div>
                                      </button>
                                      {expanded ? (
                                        <div className="space-y-3 border-t border-white/10 bg-white/[0.02] p-3">
                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            {t(`${ED}.holesEditHoleTitle`, { n: idx1 })}
                                          </p>
                                          <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground font-normal">
                                              {t(`${ED}.holesKind`)}
                                            </Label>
                                            <Select
                                              value={h.kind}
                                              onValueChange={(v) =>
                                                replaceSegmentHole(
                                                  h.id,
                                                  bendHoleWithNewKind(
                                                    h,
                                                    v as BendSegmentHoleKind
                                                  )
                                                )
                                              }
                                            >
                                              <SelectTrigger className="h-9 max-w-full">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent dir="rtl">
                                                <SelectItem value="round">
                                                  {t(`${ED}.holesKindRound`)}
                                                </SelectItem>
                                                <SelectItem value="oval">
                                                  {t(`${ED}.holesKindOval`)}
                                                </SelectItem>
                                                <SelectItem value="rect">
                                                  {t(`${ED}.holesKindRect`)}
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                                            {t(`${ED}.holesDims`)}
                                          </p>

                                          {h.kind === "round" ? (
                                            <NumField
                                              label={t(`${ED}.holesDiameter`)}
                                              value={h.diameterMm}
                                              onChange={(n) =>
                                                patchSegmentHole(h.id, {
                                                  diameterMm: Math.max(0, n),
                                                })
                                              }
                                              min={0}
                                              step={0.1}
                                            />
                                          ) : null}

                                          {h.kind === "oval" ? (
                                            <div className="space-y-3">
                                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <NumField
                                                  label={t(`${ED}.holesDiameter`)}
                                                  value={h.diameterMm}
                                                  onChange={(n) => {
                                                    const d = Math.max(0, n);
                                                    const prevLen =
                                                      resolvedOvalLengthMm(h);
                                                    patchSegmentHole(h.id, {
                                                      diameterMm: d,
                                                      ovalLengthMm: Math.max(
                                                        prevLen,
                                                        d
                                                      ),
                                                    });
                                                  }}
                                                  min={0}
                                                  step={0.1}
                                                />
                                                <NumField
                                                  label={t(`${ED}.holesOvalLength`)}
                                                  value={resolvedOvalLengthMm(h)}
                                                  onChange={(n) => {
                                                    const d = h.diameterMm;
                                                    patchSegmentHole(h.id, {
                                                      ovalLengthMm: Math.max(d, n),
                                                    });
                                                  }}
                                                  min={0}
                                                  step={0.1}
                                                />
                                              </div>
                                              <NumField
                                                label={t(`${ED}.holesRotation`)}
                                                value={h.rotationDeg ?? 0}
                                                onChange={(n) =>
                                                  patchSegmentHole(h.id, {
                                                    rotationDeg: Math.min(
                                                      180,
                                                      Math.max(-180, n)
                                                    ),
                                                  })
                                                }
                                                min={-180}
                                                step={1}
                                              />
                                            </div>
                                          ) : null}

                                          {h.kind === "rect" ? (
                                            <div className="space-y-3">
                                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <NumField
                                                  label={t(`${ED}.holesLength`)}
                                                  value={h.rectLengthMm ?? 0}
                                                  onChange={(n) =>
                                                    patchSegmentHole(h.id, {
                                                      rectLengthMm: Math.max(0, n),
                                                    })
                                                  }
                                                  min={0}
                                                  step={0.1}
                                                />
                                                <NumField
                                                  label={t(`${ED}.holesWidth`)}
                                                  value={h.rectWidthMm ?? 0}
                                                  onChange={(n) =>
                                                    patchSegmentHole(h.id, {
                                                      rectWidthMm: Math.max(0, n),
                                                    })
                                                  }
                                                  min={0}
                                                  step={0.1}
                                                />
                                              </div>
                                              <NumField
                                                label={t(`${ED}.holesRotation`)}
                                                value={h.rotationDeg ?? 0}
                                                onChange={(n) =>
                                                  patchSegmentHole(h.id, {
                                                    rotationDeg: Math.min(
                                                      180,
                                                      Math.max(-180, n)
                                                    ),
                                                  })
                                                }
                                                min={-180}
                                                step={1}
                                              />
                                            </div>
                                          ) : null}

                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => deleteSegmentHole(h.id)}
                                          >
                                            <Trash2 className="h-4 w-4" aria-hidden />
                                            {t(`${ED}.holesDeleteHoleButton`)}
                                          </Button>
                                        </div>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>

                            <div className="shrink-0 border-t border-white/10 pt-2">
                              <div className="overflow-hidden rounded-lg border border-dashed border-white/15 bg-transparent">
                                <button
                                  type="button"
                                  className={cn(
                                    "flex w-full items-center gap-2 px-2.5 py-2.5 text-start transition-colors",
                                    holePanelExpand?.type === "new"
                                      ? "bg-white/[0.06]"
                                      : "hover:bg-white/[0.04]"
                                  )}
                                  aria-expanded={holePanelExpand?.type === "new"}
                                  onClick={() =>
                                    setHolePanelExpand((ex) =>
                                      ex?.type === "new" ? null : { type: "new" }
                                    )
                                  }
                                >
                                  <ChevronDown
                                    className={cn(
                                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                      holePanelExpand?.type === "new" && "rotate-180"
                                    )}
                                    aria-hidden
                                  />
                                  <span className="flex flex-1 items-center gap-2 text-sm font-medium">
                                    <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    {t(`${ED}.holesAddNew`)}
                                  </span>
                                </button>
                                {holePanelExpand?.type === "new" ? (
                                  <div className="space-y-3 border-t border-white/10 p-3">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        {t(`${ED}.holesNewHoleTitle`)}
                                      </p>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground font-normal">
                                          {t(`${ED}.holesKind`)}
                                        </Label>
                                        <Select
                                          value={segmentHoleKind}
                                          onValueChange={(v) =>
                                            setSegmentHoleKind(v as BendSegmentHoleKind)
                                          }
                                        >
                                          <SelectTrigger className="h-9 max-w-full">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent dir="rtl">
                                            <SelectItem value="round">
                                              {t(`${ED}.holesKindRound`)}
                                            </SelectItem>
                                            <SelectItem value="oval">
                                              {t(`${ED}.holesKindOval`)}
                                            </SelectItem>
                                            <SelectItem value="rect">
                                              {t(`${ED}.holesKindRect`)}
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                                        {t(`${ED}.holesDims`)}
                                      </p>

                                      {segmentHoleKind === "round" ? (
                                        <NumField
                                          label={t(`${ED}.holesDiameter`)}
                                          value={holeDraftDiameterMm}
                                          onChange={(n) =>
                                            setHoleDraftDiameterMm(Math.max(0, n))
                                          }
                                          min={0}
                                          step={0.1}
                                        />
                                      ) : null}

                                      {segmentHoleKind === "oval" ? (
                                        <div className="space-y-3">
                                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <NumField
                                              label={t(`${ED}.holesDiameter`)}
                                              value={holeDraftDiameterMm}
                                              onChange={(n) =>
                                                setHoleDraftDiameterMm(Math.max(0, n))
                                              }
                                              min={0}
                                              step={0.1}
                                            />
                                            <NumField
                                              label={t(`${ED}.holesOvalLength`)}
                                              value={holeDraftOvalLengthMm}
                                              onChange={(n) =>
                                                setHoleDraftOvalLengthMm(Math.max(0, n))
                                              }
                                              min={0}
                                              step={0.1}
                                            />
                                          </div>
                                          <NumField
                                            label={t(`${ED}.holesRotation`)}
                                            value={holeDraftOvalRotationDeg}
                                            onChange={(n) =>
                                              setHoleDraftOvalRotationDeg(
                                                Math.min(180, Math.max(-180, n))
                                              )
                                            }
                                            min={-180}
                                            step={1}
                                          />
                                        </div>
                                      ) : null}

                                      {segmentHoleKind === "rect" ? (
                                        <div className="space-y-3">
                                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <NumField
                                              label={t(`${ED}.holesLength`)}
                                              value={holeDraftRectLengthMm}
                                              onChange={(n) =>
                                                setHoleDraftRectLengthMm(Math.max(0, n))
                                              }
                                              min={0}
                                              step={0.1}
                                            />
                                            <NumField
                                              label={t(`${ED}.holesWidth`)}
                                              value={holeDraftRectWidthMm}
                                              onChange={(n) =>
                                                setHoleDraftRectWidthMm(Math.max(0, n))
                                              }
                                              min={0}
                                              step={0.1}
                                            />
                                          </div>
                                          <NumField
                                            label={t(`${ED}.holesRotation`)}
                                            value={holeDraftRectRotationDeg}
                                            onChange={(n) =>
                                              setHoleDraftRectRotationDeg(
                                                Math.min(180, Math.max(-180, n))
                                              )
                                            }
                                            min={-180}
                                            step={1}
                                          />
                                        </div>
                                      ) : null}

                                    <Button
                                      type="button"
                                      className="w-full"
                                      onClick={addSegmentHole}
                                    >
                                      {t(`${ED}.holesAddConfirm`)}
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 border-t border-white/10 pt-3">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={closeEditorSection}
                      >
                        {t(`${ED}.back`)}
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={
                          editorSidebarScreen === "basic"
                            ? saveBasicDataSection
                            : closeEditorSection
                        }
                      >
                        {t(`${ED}.save`)}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                ref={canvasFaceWrapRef}
                className="relative flex min-h-0 flex-1 overflow-hidden bg-[#0f1419] p-1.5 sm:p-2"
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={cn(
                    "absolute left-2 top-2 z-10 gap-1.5 shadow-md sm:left-3 sm:top-3",
                    "[color-scheme:dark]"
                  )}
                  onClick={() => setPreview3dOpen(true)}
                >
                  {t(`${ED}.preview3d`)}
                </Button>
                {form.template !== "plate" &&
                holeViewSegmentIndex !== null &&
                profileSegmentDims[holeViewSegmentIndex] ? (
                  <>
                    <SegmentFacePreview2D
                      lengthMm={profileSegmentDims[holeViewSegmentIndex].lengthMm}
                      widthMm={form.global.plateWidthMm}
                      segmentLabel={profileSegmentDims[holeViewSegmentIndex].label}
                      holes={form.segmentFaceHoles?.[holeViewSegmentIndex] ?? []}
                      onHolePositionChange={handleSegmentHolePositionChange}
                      selectedHoleId={canvasSelectedHoleId}
                      onHoleSelect={handleCanvasHoleSelect}
                      onDimensionGuideLineClick={handleDimensionGuideLineClick}
                      dimensionGuidesActiveHoleId={segmentFaceCanvasGuidesHoleId}
                      placementTooltipHoleId={holePlacementTooltipHoleId}
                      onClearPlacementTooltip={() =>
                        setHolePlacementTooltipHoleId(null)
                      }
                      fill
                      className="h-full w-full min-h-0 rounded-md border-0 bg-transparent"
                    />
                    <SegmentHoleDimGuidePopover
                      open={holeDimPopover !== null}
                      edge={holeDimPopover?.edge ?? "top"}
                      initialMm={holeDimGuideInitialMm}
                      anchor={holeDimPopover?.anchor ?? { left: 0, top: 0 }}
                      onApply={handleHoleDimGuideApply}
                      onClose={() => setHoleDimPopover(null)}
                    />
                  </>
                ) : (
                  <ProfilePreview2D
                    pts={pts}
                    segments={profileSegmentDims}
                    bendAnglesDeg={profileBendAnglesDeg}
                    fill
                    className="h-full w-full min-h-0 rounded-md border-0 bg-transparent"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex shrink-0 flex-wrap items-center justify-start gap-2 border-t border-white/[0.08] bg-card/60 px-4 py-3 sm:px-5"
          dir="ltr"
        >
          <Button type="button" className="gap-2" onClick={handleSaveClick}>
            <Save className="h-4 w-4" aria-hidden />
            {t(`${ED}.save`)}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="inline-flex flex-row gap-2"
            onClick={handleBackClick}
          >
            <span>{t(`${ED}.back`)}</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </div>
      </div>

      <Dialog open={preview3dOpen} onOpenChange={setPreview3dOpen}>
        <DialogContent className="max-w-[min(96vw,56rem)] gap-0 p-0" dir="rtl" showCloseButton={false}>
          <DialogHeader className="border-b border-white/[0.08] px-6 py-4 sm:text-start">
            <DialogTitle>{t(`${ED}.preview3dTitle`)}</DialogTitle>
            <DialogDescription className="text-sm">{t(`${ED}.preview3dDescription`)}</DialogDescription>
          </DialogHeader>
          <div className="relative min-h-[min(70vh,560px)] w-full bg-[#0f1419] p-4 sm:p-5">
            <ProfilePreview3D
              pts={pts}
              plateWidthMm={form.global.plateWidthMm}
              thicknessMm={form.global.thicknessMm}
              insideRadiusMm={form.global.insideRadiusMm ?? form.global.thicknessMm}
              flatPlate={form.template === "plate"}
              fill
              className="h-full min-h-[min(64vh,500px)] w-full rounded-md border-0 bg-transparent"
            />
          </div>
          <DialogFooter className="border-t border-white/[0.08] px-6 py-3">
            <Button type="button" variant="outline" onClick={() => setPreview3dOpen(false)}>
              {t(`${ED}.close`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveValidationOpen} onOpenChange={setSaveValidationOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl" showCloseButton={false}>
          <DialogHeader className="sm:text-start">
            <DialogTitle>{t(`${ED}.saveValidationTitle`)}</DialogTitle>
            <DialogDescription>{t(`${ED}.saveValidationDescription`)}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 ps-5 text-sm text-foreground">
            {saveValidationLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <DialogFooter className="sm:justify-start">
            <Button type="button" onClick={() => setSaveValidationOpen(false)}>
              {t(`${BP}.hubValidationOk`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl" showCloseButton={false}>
          <DialogHeader className="sm:text-start">
            <DialogTitle>{t(`${ED}.editorBackTitle`)}</DialogTitle>
            <DialogDescription>{t(`${ED}.editorBackDescription`)}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start sm:gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => setBackConfirmOpen(false)}>
              {t(`${ED}.cancel`)}
            </Button>
            <Button type="button" variant="default" onClick={confirmBackDiscard}>
              {t(`${ED}.discardBack`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const tmpl = form.template;

  if (tmpl === "l") {
    return (
      <div className="space-y-3">
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.l.legABend`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.l.dimA`)}
              value={form.l.aMm}
              onChange={(n) => setForm((s) => ({ ...s, l: { ...s.l, aMm: Math.max(0, n) } }))}
              min={0}
            />
            <NumField
              label={t(`${ED}.l.includedAngle`)}
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
            {t(`${ED}.l.legB`)}
          </p>
          <NumField
            label={t(`${ED}.l.dimB`)}
            value={form.l.bMm}
            onChange={(n) => setForm((s) => ({ ...s, l: { ...s.l, bMm: Math.max(0, n) } }))}
            min={0}
          />
        </div>
      </div>
    );
  }

  if (tmpl === "u") {
    const block = form.u;
    return (
      <div className="space-y-3">
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.u.legA`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.u.dimA`)}
              value={block.aMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, u: { ...s.u, aMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.u.includedAngle1`)}
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
            {t(`${ED}.u.legB`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.u.dimB`)}
              value={block.bMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, u: { ...s.u, bMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.u.includedAngle2`)}
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
            {t(`${ED}.u.legC`)}
          </p>
          <NumField
            label={t(`${ED}.u.dimC`)}
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

  if (tmpl === "z") {
    const block = form.z;
    return (
      <div className="space-y-3">
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.z.legA`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.z.dimA`)}
              value={block.aMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, z: { ...s.z, aMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.z.includedAngle1`)}
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
            {t(`${ED}.z.legB`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.z.dimB`)}
              value={block.bMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, z: { ...s.z, bMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.z.includedAngle2`)}
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
            {t(`${ED}.z.legC`)}
          </p>
          <NumField
            label={t(`${ED}.z.dimC`)}
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

  if (tmpl === "omega") {
    const o = form.omega;
    return (
      <div className="space-y-3">
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.omega.leftFlangeA`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.omega.dimA`)}
              value={o.aMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, omega: { ...s.omega, aMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.omega.angN`, { n: 1 })}
              value={o.angle1Deg}
              onChange={(n) =>
                setForm((s) => ({
                  ...s,
                  omega: { ...s.omega, angle1Deg: Math.min(180, Math.max(0, n)) },
                }))
              }
              step={0.1}
            />
          </div>
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.omega.leftWallB`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.omega.dimB`)}
              value={o.bMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, omega: { ...s.omega, bMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.omega.angN`, { n: 2 })}
              value={o.angle2Deg}
              onChange={(n) =>
                setForm((s) => ({
                  ...s,
                  omega: { ...s.omega, angle2Deg: Math.min(180, Math.max(0, n)) },
                }))
              }
              step={0.1}
            />
          </div>
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.omega.topC`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.omega.dimC`)}
              value={o.cMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, omega: { ...s.omega, cMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.omega.angN`, { n: 3 })}
              value={o.angle3Deg}
              onChange={(n) =>
                setForm((s) => ({
                  ...s,
                  omega: { ...s.omega, angle3Deg: Math.min(180, Math.max(0, n)) },
                }))
              }
              step={0.1}
            />
          </div>
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.omega.rightWallD`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.omega.dimD`)}
              value={o.dMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, omega: { ...s.omega, dMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.omega.angN`, { n: 4 })}
              value={o.angle4Deg}
              onChange={(n) =>
                setForm((s) => ({
                  ...s,
                  omega: { ...s.omega, angle4Deg: Math.min(180, Math.max(0, n)) },
                }))
              }
              step={0.1}
            />
          </div>
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.omega.rightFlangeE`)}
          </p>
          <NumField
            label={t(`${ED}.omega.dimE`)}
            value={o.eMm}
            onChange={(n) =>
              setForm((s) => ({ ...s, omega: { ...s.omega, eMm: Math.max(0, n) } }))
            }
            min={0}
          />
        </div>
      </div>
    );
  }

  if (tmpl === "plate") {
    const pl = form.plate;
    return (
      <div className="space-y-3">
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.plate.rectTitle`)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{t(`${ED}.plate.rectHint`)}</p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.plate.lengthMm`)}
              value={pl.lengthMm}
              onChange={(n) =>
                setForm((s) => ({
                  ...s,
                  plate: { ...s.plate, lengthMm: Math.max(0, n) },
                }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.plate.widthMm`)}
              value={pl.widthMm}
              onChange={(n) =>
                setForm((s) => ({
                  ...s,
                  plate: { ...s.plate, widthMm: Math.max(0, n) },
                }))
              }
              min={0}
            />
          </div>
        </div>
      </div>
    );
  }

  if (tmpl === "gutter") {
    const g = form.gutter;
    return (
      <div className="space-y-3">
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.gutter.leftLipA`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.gutter.dimA`)}
              value={g.aMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, gutter: { ...s.gutter, aMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.gutter.angN`, { n: 1 })}
              value={g.angle1Deg}
              onChange={(n) =>
                setForm((s) => ({
                  ...s,
                  gutter: { ...s.gutter, angle1Deg: Math.min(180, Math.max(0, n)) },
                }))
              }
              step={0.1}
            />
          </div>
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.gutter.leftWallB`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.gutter.dimB`)}
              value={g.bMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, gutter: { ...s.gutter, bMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.gutter.angN`, { n: 2 })}
              value={g.angle2Deg}
              onChange={(n) =>
                setForm((s) => ({
                  ...s,
                  gutter: { ...s.gutter, angle2Deg: Math.min(180, Math.max(0, n)) },
                }))
              }
              step={0.1}
            />
          </div>
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.gutter.floorC`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.gutter.dimC`)}
              value={g.cMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, gutter: { ...s.gutter, cMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.gutter.angN`, { n: 3 })}
              value={g.angle3Deg}
              onChange={(n) =>
                setForm((s) => ({
                  ...s,
                  gutter: { ...s.gutter, angle3Deg: Math.min(180, Math.max(0, n)) },
                }))
              }
              step={0.1}
            />
          </div>
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.gutter.rightWallD`)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t(`${ED}.gutter.dimD`)}
              value={g.dMm}
              onChange={(n) =>
                setForm((s) => ({ ...s, gutter: { ...s.gutter, dMm: Math.max(0, n) } }))
              }
              min={0}
            />
            <NumField
              label={t(`${ED}.gutter.angN`, { n: 4 })}
              value={g.angle4Deg}
              onChange={(n) =>
                setForm((s) => ({
                  ...s,
                  gutter: { ...s.gutter, angle4Deg: Math.min(180, Math.max(0, n)) },
                }))
              }
              step={0.1}
            />
          </div>
        </div>
        <div className={SEGMENT_DIM_BOX}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${ED}.gutter.rightLipE`)}
          </p>
          <NumField
            label={t(`${ED}.gutter.dimE`)}
            value={g.eMm}
            onChange={(n) =>
              setForm((s) => ({ ...s, gutter: { ...s.gutter, eMm: Math.max(0, n) } }))
            }
            min={0}
          />
        </div>
      </div>
    );
  }

  if (tmpl === "custom") {
    const c = form.custom;
    const n = Math.min(7, Math.max(2, c.segmentCount));
    return (
      <div className="space-y-4">
        <div className="max-w-xs space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">{t(`${ED}.segmentCount`)}</Label>
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
            <SelectContent dir="rtl">
              {[2, 3, 4, 5, 6, 7].map((x) => (
                <SelectItem key={x} value={String(x)}>
                  {t(`${ED}.segmentsN`, { n: x })}
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
                  {isLast
                    ? t(`${ED}.segmentEnd`, { n: i + 1 })
                    : t(`${ED}.segmentBend`, { n: i + 1 })}
                </p>
                {isLast ? (
                  <NumField
                    label={t(`${ED}.lengthMm`)}
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
                      label={t(`${ED}.segmentLenLabel`, { n: i + 1 })}
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
                      label={t(`${ED}.turnAfterDeg`, { n: i + 1 })}
                      value={c.anglesDeg[i] ?? 0}
                      onChange={(v) =>
                        setForm((s) => {
                          const next = [...s.custom.anglesDeg];
                          while (next.length < 6) next.push(0);
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
