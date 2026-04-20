"use client";

import { useState } from "react";
import Link from "next/link";
import { BookUser, Search } from "lucide-react";
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
import type { QuickQuoteJobDetails } from "../types/quickQuote";
import { QUICK_QUOTE_CURRENCY_OPTIONS } from "../lib/quickQuoteCurrencies";

const CLIENT_DATALIST_ID = "quick-quote-client-suggestions";

interface JobDetailsFormProps {
  value: QuickQuoteJobDetails;
  onChange: (value: QuickQuoteJobDetails) => void;
}

export function JobDetailsForm({ value, onChange }: JobDetailsFormProps) {
  const patch = (partial: Partial<QuickQuoteJobDetails>) =>
    onChange({ ...value, ...partial });

  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

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

  return (
    <div className="ds-surface overflow-hidden">
      <div className="ds-surface-header">
        <h3 className="text-sm font-semibold text-foreground">Job details</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Reference information for this quote package
        </p>
      </div>
      <div className="p-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="qq-ref">Quote reference (ID)</Label>
          <Input
            id="qq-ref"
            readOnly
            value={value.referenceNumber || "Assigning…"}
            className="font-mono text-sm bg-muted/40 cursor-default"
            title="Unique id for this quote — generated automatically"
          />
          <p className="text-[11px] text-muted-foreground">
            This reference is the unique identifier for the quote and is generated when you open
            Quick Quote.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="qq-project">
            Project name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="qq-project"
            value={value.projectName}
            onChange={(e) => patch({ projectName: e.target.value })}
            placeholder="Project or job title"
            autoComplete="off"
            required
            aria-required="true"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="qq-customer">
            Customer name <span className="text-destructive">*</span>
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="relative flex-1 min-w-0">
              <Input
                id="qq-customer"
                list={CLIENT_DATALIST_ID}
                value={value.customerName}
                onChange={(e) => onCustomerInputChange(e.target.value)}
                placeholder="Type a customer name or pick from your directory"
                autoComplete="off"
                required
                aria-required="true"
              />
              <datalist id={CLIENT_DATALIST_ID}>
                {clientsSorted.map((c) => (
                  <option key={c.id} value={c.fullName} />
                ))}
              </datalist>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              Free text, browser suggestions from saved names, or open the directory to select.
            </span>
            {value.customerClientId ? (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Linked to client record
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={value.currency}
            onValueChange={(currency) => patch({ currency })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent className="max-h-[min(320px,50vh)]">
              {QUICK_QUOTE_CURRENCY_OPTIONS.map(({ code, label }) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="qq-notes">Notes</Label>
          <Textarea
            id="qq-notes"
            value={value.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Delivery, tolerance, or commercial notes (optional)"
            rows={3}
            className="resize-y min-h-[80px]"
          />
        </div>
      </div>

      <Dialog open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
        <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 space-y-1">
            <DialogTitle>Select customer</DialogTitle>
            <DialogDescription>
              Choose a client from your directory. You can still edit the name in the field
              afterward (that clears the directory link).
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or code…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-8 h-9"
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
                  {clientsSorted.length === 0 ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/clients/new" onClick={() => setClientPickerOpen(false)}>
                        Add a client
                      </Link>
                    </Button>
                  ) : null}
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
          <div className="border-t border-border px-4 py-3 flex justify-end gap-2 bg-card/40">
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
