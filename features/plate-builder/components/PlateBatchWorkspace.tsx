"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Konva from "konva";
import { Stage, Layer, Rect, Group } from "react-konva";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { nanoid } from "@/lib/utils/nanoid";
import { saveBatch, getBatchById, getClientsByBatch } from "@/lib/store";
import type { Batch, Client } from "@/types";
import type { PlateBuilderSpecV1 } from "../types";
import {
  downloadPlateDxf,
  PLATE_BUILDER_STANDALONE_CLIENT_ID,
} from "../lib/downloadPlateDxf";
import { saveBuiltPlateToBatch } from "../lib/saveBuiltPlate";
import {
  previewMarginMm,
  BATCH_VIEWPORT_SCALE_MIN,
  BATCH_VIEWPORT_SCALE_MAX,
} from "../lib/plateViewConstants";
import {
  PlateKonvaPlate,
  plateCanvasSizeForMmScale,
  isKonvaHoleOrSlotDragTarget,
} from "./plateKonva/PlateKonvaPlate";

const PLATE_GAP_PX = 56;
const LAYOUT_ORIGIN_PX = 40;

type WorkspacePlate = {
  id: string;
  spec: PlateBuilderSpecV1;
  /** World position inside the zoomed workspace `Group` (draggable). */
  worldX: number;
  worldY: number;
};

function workspacePlatesBBox(
  plates: WorkspacePlate[],
  items: { cw: number; ch: number }[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (plates.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < plates.length; i++) {
    const p = plates[i];
    const it = items[i];
    if (!p || !it) continue;
    minX = Math.min(minX, p.worldX);
    minY = Math.min(minY, p.worldY);
    maxX = Math.max(maxX, p.worldX + it.cw);
    maxY = Math.max(maxY, p.worldY + it.ch);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/** Place a new plate after the last one in array order (respects user-dragged positions). */
function nextPlateWorldPosition(
  plates: WorkspacePlate[],
  geometryItems: { cw: number; ch: number }[],
  newSpec: PlateBuilderSpecV1,
  mmScale: number,
  stageW: number
): { worldX: number; worldY: number } {
  const rowWrap = Math.max(560, Math.min(stageW * 0.92, 5600));
  const m = previewMarginMm(newSpec.width, newSpec.height);
  const { cw: newCw } = plateCanvasSizeForMmScale(
    newSpec.width,
    newSpec.height,
    m,
    mmScale
  );
  if (plates.length === 0) {
    return { worldX: LAYOUT_ORIGIN_PX, worldY: LAYOUT_ORIGIN_PX };
  }
  const last = plates[plates.length - 1]!;
  const lastItem = geometryItems[plates.length - 1]!;
  const nx = last.worldX + lastItem.cw + PLATE_GAP_PX;
  const ny = last.worldY;
  if (nx > LAYOUT_ORIGIN_PX && nx + newCw > rowWrap) {
    return {
      worldX: LAYOUT_ORIGIN_PX,
      worldY: last.worldY + lastItem.ch + PLATE_GAP_PX,
    };
  }
  return { worldX: nx, worldY: ny };
}

function layoutPlatesForBatch(
  specs: PlateBuilderSpecV1[],
  mmScale: number,
  rowWrapPx: number
): {
  items: { worldX: number; worldY: number; cw: number; ch: number }[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
} {
  if (specs.length === 0 || !Number.isFinite(mmScale) || mmScale <= 0) {
    return {
      items: [],
      bbox: {
        minX: LAYOUT_ORIGIN_PX,
        minY: LAYOUT_ORIGIN_PX,
        maxX: LAYOUT_ORIGIN_PX,
        maxY: LAYOUT_ORIGIN_PX,
      },
    };
  }
  let x = LAYOUT_ORIGIN_PX;
  let y = LAYOUT_ORIGIN_PX;
  let rowH = 0;
  const items: {
    worldX: number;
    worldY: number;
    cw: number;
    ch: number;
  }[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const spec of specs) {
    const m = previewMarginMm(spec.width, spec.height);
    const { cw, ch } = plateCanvasSizeForMmScale(
      spec.width,
      spec.height,
      m,
      mmScale
    );
    if (x > LAYOUT_ORIGIN_PX && x + cw > rowWrapPx) {
      x = LAYOUT_ORIGIN_PX;
      y += rowH + PLATE_GAP_PX;
      rowH = 0;
    }
    items.push({ worldX: x, worldY: y, cw, ch });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + cw);
    maxY = Math.max(maxY, y + ch);
    rowH = Math.max(rowH, ch);
    x += cw + PLATE_GAP_PX;
  }

  return {
    items,
    bbox: { minX, minY, maxX, maxY },
  };
}

/** Largest shared mm→px scale so the full layout fits the stage (plates stay proportional). */
function maxMmScaleThatFits(
  specs: PlateBuilderSpecV1[],
  stageW: number,
  stageH: number
): number {
  if (specs.length === 0) return 0.08;
  const margin = 100;
  const tw = Math.max(280, stageW - margin);
  const th = Math.max(200, stageH - margin);
  const rowWrap = Math.max(560, Math.min(stageW * 0.92, 5600));

  const fits = (s: number) => {
    const { bbox } = layoutPlatesForBatch(specs, s, rowWrap);
    const w = bbox.maxX + 80;
    const h = bbox.maxY + 80;
    return w <= tw && h <= th;
  };

  let lo = 1e-8;
  if (!fits(lo)) return lo;
  let hi = lo * 2;
  while (fits(hi) && hi < 80) hi *= 2;
  if (fits(hi)) return hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

function defaultSpecFromQuickAdd(
  input: {
    width: number;
    height: number;
    quantity: number;
    thickness: number;
    material: string;
  },
  clientId: string,
  partIndex: number
): PlateBuilderSpecV1 {
  return {
    version: 1,
    shapeType: "rectangle",
    width: input.width,
    height: input.height,
    cornerRadius: 12,
    chamferSize: 10,
    holes: [],
    slots: [],
    partName: `Plate ${partIndex}`,
    quantity: input.quantity,
    material: input.material.trim() || "—",
    thickness: input.thickness,
    clientId,
  };
}

export interface PlateBatchWorkspaceProps {
  /** When set, workspace is tied to this batch (skip create-batch modal). */
  batchId?: string;
  clients?: Client[];
  defaultClientId?: string;
}

export function PlateBatchWorkspace({
  batchId: batchIdProp,
  clients: clientsProp,
  defaultClientId = "",
}: PlateBatchWorkspaceProps) {
  const router = useRouter();
  const [batchId, setBatchId] = useState<string | null>(batchIdProp ?? null);
  const [batchNameDraft, setBatchNameDraft] = useState("");
  const [batchModalOpen, setBatchModalOpen] = useState(!batchIdProp);

  const [clients, setClients] = useState<Client[]>(clientsProp ?? []);
  const [clientId, setClientId] = useState(() => {
    const list = clientsProp ?? [];
    if (
      defaultClientId &&
      list.some((c) => c.id === defaultClientId)
    ) {
      return defaultClientId;
    }
    return list[0]?.id ?? PLATE_BUILDER_STANDALONE_CLIENT_ID;
  });

  useEffect(() => {
    if (batchIdProp) {
      setClients(getClientsByBatch(batchIdProp));
    }
  }, [batchIdProp]);

  useEffect(() => {
    if (!batchIdProp || !defaultClientId) return;
    if (clients.some((c) => c.id === defaultClientId)) {
      setClientId(defaultClientId);
    }
  }, [batchIdProp, defaultClientId, clients]);

  const effectiveBatchId = batchIdProp ?? batchId;
  const batch = effectiveBatchId ? getBatchById(effectiveBatchId) : undefined;

  const [plates, setPlates] = useState<WorkspacePlate[]>([]);
  const platesRef = useRef(plates);
  platesRef.current = plates;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [addPlateOpen, setAddPlateOpen] = useState(false);
  const [quickWidth, setQuickWidth] = useState("200");
  const [quickHeight, setQuickHeight] = useState("120");
  const [quickQty, setQuickQty] = useState("1");
  const [quickThick, setQuickThick] = useState("10");
  const [quickMaterial, setQuickMaterial] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });
  const panRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    button: 0,
  });
  /** Only plain left button may move plates; middle / right / Shift+left use pan or are ignored for drag. */
  const plateDragAllowedRef = useRef(true);
  /**
   * Konva may still emit dragEnd after middle-button pan; Stage mouseup resets plateDragAllowedRef
   * before dragEnd, so we must only commit worldX/worldY after a real left-drag (dragStart allowed it).
   */
  const plateCommitWorldOnDragEndRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setStageSize({
        w: Math.max(320, Math.floor(r.width)),
        h: Math.max(240, Math.floor(r.height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wheelHandler = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setViewport((v) => {
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        const nextScale = Math.min(
          BATCH_VIEWPORT_SCALE_MAX,
          Math.max(BATCH_VIEWPORT_SCALE_MIN, v.scale * factor)
        );
        const worldX = (mx - v.x) / v.scale;
        const worldY = (my - v.y) / v.scale;
        return {
          scale: nextScale,
          x: mx - worldX * nextScale,
          y: my - worldY * nextScale,
        };
      });
    },
    []
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler);
  }, [wheelHandler]);

  const createBatchFromModal = () => {
    const name = batchNameDraft.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const b: Batch = {
      id: nanoid(),
      name,
      status: "draft",
      clientIds: [],
      cuttingMethod: "laser",
      createdAt: now,
      updatedAt: now,
    };
    saveBatch(b);
    setBatchId(b.id);
    setBatchModalOpen(false);
    setClientId(PLATE_BUILDER_STANDALONE_CLIENT_ID);
  };

  const batchLayoutKey = useMemo(
    () =>
      plates
        .map((p) => `${p.id}:${p.spec.width}:${p.spec.height}`)
        .join("|") + `|${stageSize.w}x${stageSize.h}`,
    [plates, stageSize.w, stageSize.h]
  );

  const batchGeometry = useMemo(() => {
    const specs = plates.map((p) => p.spec);
    const mmScale = maxMmScaleThatFits(specs, stageSize.w, stageSize.h);
    const rowWrap = Math.max(560, Math.min(stageSize.w * 0.92, 5600));
    return {
      mmScale,
      ...layoutPlatesForBatch(specs, mmScale, rowWrap),
    };
  }, [batchLayoutKey]);

  useEffect(() => {
    const current = platesRef.current;
    if (current.length === 0) return;
    const bbox = workspacePlatesBBox(current, batchGeometry.items);
    if (!bbox) return;
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    setViewport({
      x: stageSize.w / 2 - cx,
      y: stageSize.h / 2 - cy,
      scale: 1,
    });
  }, [batchLayoutKey, plates.length, stageSize.w, stageSize.h, batchGeometry.items]);

  const addPlate = () => {
    const w = Number(quickWidth);
    const h = Number(quickHeight);
    const q = Number(quickQty);
    const t = Number(quickThick);
    if (!Number.isFinite(w) || w <= 0) return;
    if (!Number.isFinite(h) || h <= 0) return;
    if (!Number.isFinite(q) || q < 1) return;
    if (!Number.isFinite(t) || t <= 0) return;
    const spec = defaultSpecFromQuickAdd(
      {
        width: w,
        height: h,
        quantity: Math.floor(q),
        thickness: t,
        material: quickMaterial,
      },
      clientId,
      plates.length + 1
    );
    const id = nanoid();
    setPlates((prev) => {
      const specs = prev.map((pl) => pl.spec);
      const mmScale = maxMmScaleThatFits(
        [...specs, spec],
        stageSize.w,
        stageSize.h
      );
      const rowWrap = Math.max(560, Math.min(stageSize.w * 0.92, 5600));
      const itemsPrev = layoutPlatesForBatch(specs, mmScale, rowWrap).items;
      const pos = nextPlateWorldPosition(
        prev,
        itemsPrev,
        spec,
        mmScale,
        stageSize.w
      );
      return [...prev, { id, spec, worldX: pos.worldX, worldY: pos.worldY }];
    });
    setSelectedId(id);
    setAddPlateOpen(false);
  };

  const selectedPlate = useMemo(
    () => plates.find((p) => p.id === selectedId) ?? null,
    [plates, selectedId]
  );

  const updateSelectedSpec = useCallback(
    (fn: (s: PlateBuilderSpecV1) => PlateBuilderSpecV1) => {
      if (!selectedId) return;
      setPlates((prev) =>
        prev.map((p) =>
          p.id === selectedId ? { ...p, spec: fn(p.spec) } : p
        )
      );
    },
    [selectedId]
  );

  const [featureDimGuide, setFeatureDimGuide] = useState<{
    kind: "hole" | "slot";
    index: number;
  } | null>(null);

  const resetView = useCallback(() => {
    if (plates.length === 0) {
      setViewport({
        x: stageSize.w / 2 - 200,
        y: stageSize.h / 2 - 150,
        scale: 1,
      });
      return;
    }
    const bbox = workspacePlatesBBox(plates, batchGeometry.items);
    if (!bbox) return;
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    setViewport({
      x: stageSize.w / 2 - cx,
      y: stageSize.h / 2 - cy,
      scale: 1,
    });
  }, [plates, batchGeometry.items, stageSize.w, stageSize.h]);

  const canSaveToBatch = Boolean(
    effectiveBatchId && getBatchById(effectiveBatchId)
  );

  const saveSelectedToBatch = () => {
    if (!selectedPlate || !effectiveBatchId) return;
    const spec: PlateBuilderSpecV1 = {
      ...selectedPlate.spec,
      clientId,
    };
    saveBuiltPlateToBatch(spec, effectiveBatchId);
    router.push(`/batches/${effectiveBatchId}/parts`);
  };

  const downloadSelectedDxf = () => {
    if (!selectedPlate) return;
    downloadPlateDxf({ ...selectedPlate.spec, clientId });
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={!!batchIdProp}>
          <DialogHeader>
            <DialogTitle>New batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="batch-name">Batch name</Label>
            <Input
              id="batch-name"
              value={batchNameDraft}
              onChange={(e) => setBatchNameDraft(e.target.value)}
              placeholder="e.g. March run #1"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {batchIdProp && (
              <Button variant="outline" asChild>
                <Link href={`/batches/${batchIdProp}`}>Cancel</Link>
              </Button>
            )}
            <Button
              type="button"
              onClick={createBatchFromModal}
              disabled={!batchNameDraft.trim()}
            >
              Create batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addPlateOpen} onOpenChange={setAddPlateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add new plate</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label>Width (mm)</Label>
              <Input
                type="number"
                min={0.001}
                step={0.1}
                value={quickWidth}
                onChange={(e) => setQuickWidth(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Length (mm)</Label>
              <Input
                type="number"
                min={0.001}
                step={0.1}
                value={quickHeight}
                onChange={(e) => setQuickHeight(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={quickQty}
                onChange={(e) => setQuickQty(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Thickness (mm)</Label>
              <Input
                type="number"
                min={0.001}
                step={0.1}
                value={quickThick}
                onChange={(e) => setQuickThick(e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Material</Label>
              <Input
                value={quickMaterial}
                onChange={(e) => setQuickMaterial(e.target.value)}
                placeholder="e.g. S355"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPlateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={addPlate}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl bg-card px-3 py-2 shadow-sm">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            Canvas
            {batch?.name ? (
              <span className="font-normal text-muted-foreground">
                {" · "}
                {batch.name}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Scroll wheel zoom · Middle-drag or Shift+drag to pan · Drag a plate to
            move it
          </p>
        </div>
        {clients.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button size="sm" onClick={() => setAddPlateOpen(true)}>
          Add new plate
        </Button>
        <Button size="sm" variant="outline" onClick={resetView}>
          Reset view
        </Button>
        {!batchIdProp && effectiveBatchId && (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/batches/${effectiveBatchId}`}>Open batch</Link>
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
        <div
          ref={containerRef}
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl bg-slate-200/80"
        >
          <div className="absolute inset-0">
          <Stage
            width={stageSize.w}
            height={stageSize.h}
            onMouseDown={(e) => {
              const stage = e.target.getStage();
              if (!stage) return;
              const node = e.target as Konva.Node;
              const isBg =
                node.getAttr("name") === "workspace-bg" || node === stage;
              if (isBg) {
                setSelectedId(null);
              }
              const btn = e.evt.button;
              const shift = e.evt.shiftKey;
              const wantPan = btn === 1 || (btn === 0 && shift);
              plateDragAllowedRef.current = btn === 0 && !shift;
              if (wantPan) {
                panRef.current = {
                  active: true,
                  lastX: e.evt.clientX,
                  lastY: e.evt.clientY,
                  button: btn,
                };
              }
            }}
            onMouseMove={(e) => {
              const p = panRef.current;
              if (!p.active) return;
              const dx = e.evt.clientX - p.lastX;
              const dy = e.evt.clientY - p.lastY;
              p.lastX = e.evt.clientX;
              p.lastY = e.evt.clientY;
              setViewport((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
            }}
            onMouseUp={() => {
              panRef.current.active = false;
              plateDragAllowedRef.current = true;
            }}
            onMouseLeave={() => {
              panRef.current.active = false;
              plateDragAllowedRef.current = true;
            }}
          >
            <Layer>
              <Rect
                name="workspace-bg"
                x={0}
                y={0}
                width={stageSize.w}
                height={stageSize.h}
                fill="#e2e8f0"
                listening
              />
              <Group
                x={viewport.x}
                y={viewport.y}
                scaleX={viewport.scale}
                scaleY={viewport.scale}
              >
                {plates.map((p, i) => {
                  const slot = batchGeometry.items[i];
                  if (!slot) return null;
                  return (
                  <Group
                    key={p.id}
                    name="workspace-plate"
                    x={p.worldX}
                    y={p.worldY}
                    draggable
                    dragDistance={6}
                    onMouseDown={(e) => {
                      plateDragAllowedRef.current =
                        e.evt.button === 0 && !e.evt.shiftKey;
                      if (e.evt.button !== 0 || e.evt.shiftKey) return;
                      // Select on press; draggable parent can swallow child onTap — don’t require a drag.
                      setSelectedId(p.id);
                    }}
                    onDragStart={(e) => {
                      if (!plateDragAllowedRef.current) {
                        plateCommitWorldOnDragEndRef.current = false;
                        e.target.stopDrag();
                        return;
                      }
                      plateCommitWorldOnDragEndRef.current = true;
                    }}
                    onDragEnd={(e) => {
                      const plate = e.currentTarget as Konva.Group;
                      if (!plateCommitWorldOnDragEndRef.current) return;
                      plateCommitWorldOnDragEndRef.current = false;
                      // Hole/slot drag: e.target is the circle/group — do not write its x/y as world position.
                      if (isKonvaHoleOrSlotDragTarget(e.target, plate)) return;
                      setPlates((prev) =>
                        prev.map((pl) =>
                          pl.id === p.id
                            ? {
                                ...pl,
                                worldX: plate.x(),
                                worldY: plate.y(),
                              }
                            : pl
                        )
                      );
                      setSelectedId(p.id);
                    }}
                  >
                    <PlateKonvaPlate
                      cw={slot.cw}
                      ch={slot.ch}
                      batchMmScale={batchGeometry.mmScale}
                      spec={p.spec}
                      selected={selectedId === p.id}
                      onPlateSelect={() => setSelectedId(p.id)}
                      featureDimGuide={
                        selectedId === p.id ? featureDimGuide : null
                      }
                      onHoleDragGuide={(idx) =>
                        setFeatureDimGuide(
                          idx === null ? null : { kind: "hole", index: idx }
                        )
                      }
                      onSlotDragGuide={(idx) =>
                        setFeatureDimGuide(
                          idx === null ? null : { kind: "slot", index: idx }
                        )
                      }
                      onHoleCenterChange={(i, cx, cy) => {
                        setPlates((prev) =>
                          prev.map((pl) =>
                            pl.id === p.id
                              ? {
                                  ...pl,
                                  spec: {
                                    ...pl.spec,
                                    holes: pl.spec.holes.map((h, j) =>
                                      j === i ? { ...h, cx, cy } : h
                                    ),
                                  },
                                }
                              : pl
                          )
                        );
                      }}
                      onSlotCenterChange={(i, cx, cy) => {
                        setPlates((prev) =>
                          prev.map((pl) =>
                            pl.id === p.id
                              ? {
                                  ...pl,
                                  spec: {
                                    ...pl.spec,
                                    slots: pl.spec.slots.map((s, j) =>
                                      j === i ? { ...s, cx, cy } : s
                                    ),
                                  },
                                }
                              : pl
                          )
                        );
                      }}
                      worldZoomScale={viewport.scale}
                    />
                  </Group>
                  );
                })}
              </Group>
            </Layer>
          </Stage>
          </div>
        </div>

        <aside className="max-h-[min(50dvh,420px)] min-h-0 w-full shrink-0 overflow-y-auto rounded-xl bg-card p-4 lg:max-h-full lg:w-[min(100%,380px)] lg:max-w-[380px]">
          {!selectedPlate ? (
            <p className="text-sm text-muted-foreground">
              Click the plate face, outline, hole, or slot to select that plate, or
              drag the plate on the canvas to move it. Then edit shape, holes, and
              slots here — same rules as before (5 mm hole snap, 1 mm slot snap).
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Selected plate</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedPlate.spec.partName} ·{" "}
                  {selectedPlate.spec.width}×{selectedPlate.spec.height} mm
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs">Part name</Label>
                <Input
                  value={selectedPlate.spec.partName}
                  onChange={(e) =>
                    updateSelectedSpec((s) => ({
                      ...s,
                      partName: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Shape</Label>
                <Select
                  value={selectedPlate.spec.shapeType}
                  onValueChange={(v) =>
                    updateSelectedSpec((s) => ({
                      ...s,
                      shapeType: v as PlateBuilderSpecV1["shapeType"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rectangle">Rectangle</SelectItem>
                    <SelectItem value="rectangleRounded">
                      Rounded corners
                    </SelectItem>
                    <SelectItem value="rectangleChamfered">
                      Chamfered corners
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Width</Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0.001}
                    value={selectedPlate.spec.width}
                    onChange={(e) =>
                      updateSelectedSpec((s) => ({
                        ...s,
                        width: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Height</Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0.001}
                    value={selectedPlate.spec.height}
                    onChange={(e) =>
                      updateSelectedSpec((s) => ({
                        ...s,
                        height: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              {selectedPlate.spec.shapeType === "rectangleRounded" && (
                <div className="space-y-1">
                  <Label className="text-xs">Corner radius</Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    value={selectedPlate.spec.cornerRadius}
                    onChange={(e) =>
                      updateSelectedSpec((s) => ({
                        ...s,
                        cornerRadius: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              )}
              {selectedPlate.spec.shapeType === "rectangleChamfered" && (
                <div className="space-y-1">
                  <Label className="text-xs">Chamfer</Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    value={selectedPlate.spec.chamferSize}
                    onChange={(e) =>
                      updateSelectedSpec((s) => ({
                        ...s,
                        chamferSize: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={selectedPlate.spec.quantity}
                    onChange={(e) =>
                      updateSelectedSpec((s) => ({
                        ...s,
                        quantity: Math.max(1, Math.floor(Number(e.target.value))),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Thickness</Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0.001}
                    value={selectedPlate.spec.thickness}
                    onChange={(e) =>
                      updateSelectedSpec((s) => ({
                        ...s,
                        thickness: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Material</Label>
                <Input
                  value={selectedPlate.spec.material}
                  onChange={(e) =>
                    updateSelectedSpec((s) => ({
                      ...s,
                      material: e.target.value,
                    }))
                  }
                />
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateSelectedSpec((s) => ({
                      ...s,
                      holes: [
                        ...s.holes,
                        {
                          id: nanoid(),
                          cx: 50,
                          cy: 50,
                          diameter: 10,
                          length: 0,
                          rotationDeg: 0,
                        },
                      ],
                    }))
                  }
                >
                  Add hole
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateSelectedSpec((s) => ({
                      ...s,
                      slots: [
                        ...s.slots,
                        {
                          id: nanoid(),
                          cx: 100,
                          cy: 60,
                          length: 40,
                          width: 12,
                          rotationDeg: 0,
                        },
                      ],
                    }))
                  }
                >
                  Add slot
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Holes (Ø / slot length / rot °)
                </p>
                {selectedPlate.spec.holes.map((hole, hi) => (
                  <div
                    key={hole.id}
                    className="flex flex-wrap items-end gap-2 rounded-md p-2"
                  >
                    <Input
                      className="h-8 w-[68px]"
                      type="number"
                      title="Diameter"
                      value={hole.diameter}
                      onChange={(e) =>
                        updateSelectedSpec((s) => ({
                          ...s,
                          holes: s.holes.map((h, j) =>
                            j === hi
                              ? { ...h, diameter: Number(e.target.value) }
                              : h
                          ),
                        }))
                      }
                    />
                    <Input
                      className="h-8 w-[68px]"
                      type="number"
                      title="Slot length"
                      value={hole.length ?? 0}
                      onChange={(e) =>
                        updateSelectedSpec((s) => ({
                          ...s,
                          holes: s.holes.map((h, j) =>
                            j === hi
                              ? { ...h, length: Number(e.target.value) }
                              : h
                          ),
                        }))
                      }
                    />
                    <Input
                      className="h-8 w-[60px]"
                      type="number"
                      title="Rotation"
                      value={hole.rotationDeg ?? 0}
                      onChange={(e) =>
                        updateSelectedSpec((s) => ({
                          ...s,
                          holes: s.holes.map((h, j) =>
                            j === hi
                              ? { ...h, rotationDeg: Number(e.target.value) }
                              : h
                          ),
                        }))
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() =>
                        updateSelectedSpec((s) => ({
                          ...s,
                          holes: s.holes.filter((_, j) => j !== hi),
                        }))
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Slots (L / W / rot °)
                </p>
                {selectedPlate.spec.slots.map((slot, si) => (
                  <div
                    key={slot.id}
                    className="flex flex-wrap items-end gap-2 rounded-md p-2"
                  >
                    <Input
                      className="h-8 w-[68px]"
                      type="number"
                      value={slot.length}
                      onChange={(e) =>
                        updateSelectedSpec((s) => ({
                          ...s,
                          slots: s.slots.map((sl, j) =>
                            j === si
                              ? { ...sl, length: Number(e.target.value) }
                              : sl
                          ),
                        }))
                      }
                    />
                    <Input
                      className="h-8 w-[68px]"
                      type="number"
                      value={slot.width}
                      onChange={(e) =>
                        updateSelectedSpec((s) => ({
                          ...s,
                          slots: s.slots.map((sl, j) =>
                            j === si
                              ? { ...sl, width: Number(e.target.value) }
                              : sl
                          ),
                        }))
                      }
                    />
                    <Input
                      className="h-8 w-[60px]"
                      type="number"
                      value={slot.rotationDeg}
                      onChange={(e) =>
                        updateSelectedSpec((s) => ({
                          ...s,
                          slots: s.slots.map((sl, j) =>
                            j === si
                              ? { ...sl, rotationDeg: Number(e.target.value) }
                              : sl
                          ),
                        }))
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() =>
                        updateSelectedSpec((s) => ({
                          ...s,
                          slots: s.slots.filter((_, j) => j !== si),
                        }))
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  disabled={!canSaveToBatch}
                  onClick={saveSelectedToBatch}
                >
                  Save to batch (DXF)
                </Button>
                <Button variant="outline" onClick={downloadSelectedDxf}>
                  Download DXF
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
