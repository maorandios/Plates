"use client";

import { useMemo, useState, useEffect } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getClients,
  linkClientsToBatch,
  createGlobalClient,
} from "@/lib/store";
export interface ClientPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  linkedClientIds: string[];
  onLinked: () => void;
}

export function ClientPicker({
  open,
  onOpenChange,
  batchId,
  linkedClientIds,
  onLinked,
}: ClientPickerProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickName, setQuickName] = useState("");
  const [tab, setTab] = useState<"pick" | "create">("pick");
  const [refresh, setRefresh] = useState(0);

  const linkedSet = useMemo(() => new Set(linkedClientIds), [linkedClientIds]);

  const pickable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return getClients()
      .filter((c) => c.status === "active")
      .filter((c) => !linkedSet.has(c.id))
      .filter(
        (c) =>
          !q ||
          c.fullName.toLowerCase().includes(q) ||
          c.shortCode.toLowerCase().includes(q)
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [search, linkedSet, refresh]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSearch("");
      setQuickName("");
      setTab("pick");
    }
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAddSelected() {
    if (selected.size === 0) return;
    linkClientsToBatch(batchId, Array.from(selected));
    onLinked();
    onOpenChange(false);
  }

  function handleQuickCreate() {
    const name = quickName.trim();
    if (name.length < 2) return;
    const client = createGlobalClient({ fullName: name, status: "active" });
    linkClientsToBatch(batchId, [client.id]);
    setRefresh((k) => k + 1);
    onLinked();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add clients to this batch</DialogTitle>
          <DialogDescription>
            Choose saved clients from your directory. Each client keeps one permanent global code
            across all batches.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border pb-2">
          <Button
            type="button"
            variant={tab === "pick" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => setTab("pick")}
          >
            Directory
          </Button>
          <Button
            type="button"
            variant={tab === "create" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 gap-1"
            onClick={() => setTab("create")}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Quick create
          </Button>
        </div>

        {tab === "pick" ? (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="rounded-lg border border-border overflow-y-auto max-h-[min(320px,40vh)] divide-y divide-border">
              {pickable.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  {getClients().length === 0
                    ? "No clients in your directory yet. Use Quick create or go to Clients."
                    : linkedSet.size >= getClients().filter((c) => c.status === "active").length
                      ? "All active clients are already on this batch."
                      : "No matches. Try another search."}
                </p>
              ) : (
                pickable.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                      selected.has(c.id) && "bg-primary/10"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border",
                        selected.has(c.id) && "bg-primary border-primary text-primary-foreground"
                      )}
                    >
                      {selected.has(c.id) && <Check className="h-3 w-3" />}
                    </span>
                    <span className="font-mono text-xs font-bold w-10 shrink-0">
                      {c.shortCode}
                    </span>
                    <span className="truncate font-medium">{c.fullName}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <div>
              <Label htmlFor="quick-client-name">Company / client name</Label>
              <Input
                id="quick-client-name"
                className="mt-1.5"
                placeholder="e.g. Alon Steel Industries"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                A unique 3-character code is assigned automatically and saved globally.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {tab === "pick" ? (
            <Button
              type="button"
              onClick={handleAddSelected}
              disabled={selected.size === 0}
            >
              Add {selected.size > 0 ? `(${selected.size})` : ""} to batch
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleQuickCreate}
              disabled={quickName.trim().length < 2}
            >
              Create &amp; attach
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
