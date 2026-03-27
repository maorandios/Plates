"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ValidationRow, ValidationRowStatus } from "../types/quickQuote";

export type PlateScope = "all" | ValidationRowStatus | "manual";

const SCOPE_OPTIONS: { id: PlateScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "valid", label: "Valid" },
  { id: "warning", label: "Warnings" },
  { id: "error", label: "Errors" },
  { id: "manual", label: "Manual selection" },
];

interface PlateScopePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ValidationRow[];
  title: string;
  description: string;
  /** Shown under the controls, e.g. how many rows are selected */
  countMessage: (selectedCount: number) => string;
  confirmLabel: string;
  onConfirm: (selectedRows: ValidationRow[]) => void;
  confirmStartIcon?: ReactNode;
}

export function PlateScopePickerDialog({
  open,
  onOpenChange,
  rows,
  title,
  description,
  countMessage,
  confirmLabel,
  onConfirm,
  confirmStartIcon,
}: PlateScopePickerDialogProps) {
  const [scope, setScope] = useState<PlateScope>("all");
  const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(
    () => new Set()
  );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setScope("all");
      setManualSelectedIds(new Set(rows.map((r) => r.id)));
    }
    onOpenChange(next);
  };

  const selectedRows = useMemo(() => {
    if (scope === "all") return rows;
    if (scope === "manual") {
      return rows.filter((r) => manualSelectedIds.has(r.id));
    }
    return rows.filter((r) => r.status === scope);
  }, [rows, scope, manualSelectedIds]);

  const toggleManualRow = (id: string, checked: boolean) => {
    setManualSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedRows.length === 0) return;
    onConfirm(selectedRows);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Plates to include</p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Plates to include"
            >
              {SCOPE_OPTIONS.map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  size="sm"
                  variant={scope === opt.id ? "default" : "outline"}
                  className="h-8"
                  onClick={() => setScope(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          {scope === "manual" && (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-sm font-medium">Pick parts</Label>
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() =>
                      setManualSelectedIds(new Set(rows.map((r) => r.id)))
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setManualSelectedIds(new Set())}
                  >
                    Clear all
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[min(280px,40vh)] rounded-md border border-border">
                <div className="p-2 space-y-0.5">
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-6 text-center">
                      No validation rows.
                    </p>
                  ) : (
                    rows.map((r) => (
                      <label
                        key={r.id}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer",
                          "hover:bg-muted/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded border border-input accent-primary"
                          checked={manualSelectedIds.has(r.id)}
                          onChange={(e) =>
                            toggleManualRow(r.id, e.target.checked)
                          }
                        />
                        <span className="flex-1 min-w-0 truncate text-sm">
                          {r.partName}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize shrink-0">
                          {r.status}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
          <p className="text-sm text-muted-foreground tabular-nums">
            {countMessage(selectedRows.length)}
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={selectedRows.length === 0}
          >
            {confirmStartIcon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
