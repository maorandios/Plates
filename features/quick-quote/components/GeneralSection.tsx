"use client";

import { useState } from "react";
import Link from "next/link";
import { BookUser, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { t } from "@/lib/i18n";
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
          {t("general.quotationId")}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="quote-id"
            readOnly
            value={value.referenceNumber || t("general.generating")}
            className="font-mono text-sm cursor-default text-[rgb(101,105,114)]"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyQuoteId}
            className="shrink-0 h-9 w-9 p-0"
            title={t("general.copyReference")}
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {/* Project name */}
      <div className="space-y-2">
        <Label htmlFor="project-name">
          {t("general.projectName")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="project-name"
          value={value.projectName}
          onChange={(e) => patch({ projectName: e.target.value })}
          placeholder={t("general.projectNamePlaceholder")}
          autoComplete="off"
          required
          aria-required="true"
        />
      </div>

      {/* Client name */}
      <div className="space-y-2">
        <Label htmlFor="client-name">
          {t("general.customerName")} <span className="text-destructive">*</span>
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="relative flex-1 min-w-0">
            <Input
              id="client-name"
              value={value.customerName}
              onChange={(e) => onCustomerInputChange(e.target.value)}
              placeholder={t("general.customerPlaceholder")}
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
            {t("general.browseClients")}
          </Button>
        </div>
        {value.customerClientId && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {t("general.linkedToClient")}
          </Badge>
        )}
      </div>

      {/* Material type */}
      <div className="space-y-2">
        <Label htmlFor="material-type">{t("general.materialType")}</Label>
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

      {/* Client picker dialog */}
      <Dialog open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md gap-0 p-0 overflow-hidden"
        >
          <DialogHeader className="space-y-2 px-5 pt-6 pb-3 text-end sm:text-end">
            <DialogTitle>{t("general.selectClientTitle")}</DialogTitle>
            <DialogDescription>
              {t("general.selectClientDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-4">
            <div className="relative">
              <Input
                placeholder={t("general.searchClientsPlaceholder")}
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <ScrollArea className="h-[min(320px,45vh)] border-t border-white/[0.08]">
            <div className="p-3">
              {filteredClients.length === 0 ? (
                <div
                  className="flex min-h-[min(280px,42vh)] flex-col items-center justify-center gap-4 px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  <p className="max-w-[min(100%,20rem)] leading-relaxed">
                    {clientsSorted.length === 0
                      ? t("general.noClientsYet")
                      : t("general.noSearchResults")}
                  </p>
                  {clientsSorted.length === 0 && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/clients/new" onClick={() => setClientPickerOpen(false)}>
                        {t("general.createNewClient")}
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
                    dir="rtl"
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-start text-sm hover:bg-muted/80 transition-colors"
                  >
                    <span className="min-w-0 flex-1 font-medium leading-snug">
                      {c.fullName}
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 font-mono text-[10px] tabular-nums"
                    >
                      {c.shortCode}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end border-t border-white/[0.08] bg-card/40 px-5 py-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setClientPickerOpen(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
