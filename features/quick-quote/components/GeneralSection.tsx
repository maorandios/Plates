"use client";

import { useState } from "react";
import Link from "next/link";
import { BookUser, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getClients } from "@/lib/store";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/types/materials";
import type { QuickQuoteJobDetails } from "../types/quickQuote";

interface GeneralSectionProps {
  value: QuickQuoteJobDetails;
  materialType: MaterialType;
  onChange: (value: QuickQuoteJobDetails) => void;
  onMaterialTypeChange: (materialType: MaterialType) => void;
}

export function GeneralSection({
  value,
  materialType,
  onChange,
  onMaterialTypeChange,
}: GeneralSectionProps) {
  const patch = (partial: Partial<QuickQuoteJobDetails>) =>
    onChange({ ...value, ...partial });

  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const clientsSorted = getClients()
    .filter((c) => c.status === "active")
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));

  const q = clientSearch.trim().toLowerCase();
  const filteredClients = !q
    ? clientsSorted
    : clientsSorted.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.shortCode.toLowerCase().includes(q) ||
          (c.contactName?.toLowerCase().includes(q) ?? false)
      );

  const applyClient = (id: string, fullName: string) => {
    patch({ customerName: fullName, customerClientId: id });
    setClientPickerOpen(false);
    setClientSearch("");
  };

  const onCustomerInputChange = (name: string) => {
    patch({
      customerName: name,
      customerClientId: undefined,
    });
  };

  const copyQuoteId = async () => {
    try {
      await navigator.clipboard.writeText(value.referenceNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API fails
    }
  };

  return (
    <div className="space-y-6">
      {/* Quotation ID */}
      <div className="space-y-2">
        <Label htmlFor="quote-id" className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Quotation ID
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="quote-id"
            readOnly
            value={value.referenceNumber || "Generating…"}
            className="font-mono text-sm bg-muted/40 cursor-default border-muted-foreground/20 text-muted-foreground"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyQuoteId}
            className="shrink-0 h-9 w-9 p-0"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {/* Project name */}
      <div className="space-y-2">
        <Label htmlFor="project-name">
          Project name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="project-name"
          value={value.projectName}
          onChange={(e) => patch({ projectName: e.target.value })}
          placeholder="Project or job title"
          autoComplete="off"
          required
          aria-required="true"
        />
      </div>

      {/* Client name */}
      <div className="space-y-2">
        <Label htmlFor="client-name">
          Client name <span className="text-destructive">*</span>
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="relative flex-1 min-w-0">
            <Input
              id="client-name"
              value={value.customerName}
              onChange={(e) => onCustomerInputChange(e.target.value)}
              placeholder="Type a client name or pick from directory"
              autoComplete="off"
              required
              aria-required="true"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 sm:w-auto gap-2"
            onClick={() => {
              setClientSearch("");
              setClientPickerOpen(true);
            }}
          >
            <BookUser className="h-4 w-4" />
            Browse clients
          </Button>
        </div>
        {value.customerClientId && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            Linked to client record
          </Badge>
        )}
      </div>

      {/* Material type */}
      <div className="space-y-2">
        <Label htmlFor="material-type">Material type</Label>
        <Select value={materialType} onValueChange={(v) => onMaterialTypeChange(v as MaterialType)}>
          <SelectTrigger id="material-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="carbonSteel">{MATERIAL_TYPE_LABELS.carbonSteel}</SelectItem>
            <SelectItem value="stainlessSteel">{MATERIAL_TYPE_LABELS.stainlessSteel}</SelectItem>
            <SelectItem value="aluminum">{MATERIAL_TYPE_LABELS.aluminum}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={value.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Delivery, tolerance, or commercial notes (optional)"
          rows={4}
          className="resize-y min-h-[100px]"
        />
      </div>

      {/* Client picker dialog */}
      <Dialog open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
        <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 space-y-1">
            <DialogTitle>Select client</DialogTitle>
            <DialogDescription>
              Choose a client from your directory. You can edit the name afterward if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Input
                placeholder="Search by name or code…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <ScrollArea className="h-[min(320px,45vh)] border-t border-border">
            <div className="p-2 space-y-0.5">
              {filteredClients.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground space-y-3">
                  <p>
                    {clientsSorted.length === 0
                      ? "No active clients in your directory yet."
                      : "No clients match your search."}
                  </p>
                  {clientsSorted.length === 0 && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/clients/new" onClick={() => setClientPickerOpen(false)}>
                        Add a client
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                filteredClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => applyClient(c.id, c.fullName)}
                    className="w-full text-left rounded-md px-3 py-2.5 text-sm hover:bg-muted/80 transition-colors flex items-start justify-between gap-2"
                  >
                    <span className="font-medium leading-snug">{c.fullName}</span>
                    <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                      {c.shortCode}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="border-t border-border px-4 py-3 flex justify-end gap-2 bg-muted/20">
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/clients" onClick={() => setClientPickerOpen(false)}>
                Open Clients
              </Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setClientPickerOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
