"use client";

import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListScreenHebrewDatePicker } from "@/components/shared/ListScreenHebrewDatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/lib/i18n";
import { listFilterStatusSelectClassName } from "@/lib/listScreenApprovalSelectStyles";
import type { ListStatusFilter } from "@/lib/listScreenFilters";

export interface ListScreenFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  dateYmd: string;
  onDateYmdChange: (value: string) => void;
  status: ListStatusFilter;
  onStatusChange: (value: ListStatusFilter) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

export function ListScreenFilterBar({
  search,
  onSearchChange,
  dateYmd,
  onDateYmdChange,
  status,
  onStatusChange,
  onReset,
  hasActiveFilters,
}: ListScreenFilterBarProps) {
  return (
    <div
      className="mb-4 flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:px-5 lg:flex-row lg:flex-wrap lg:items-end lg:gap-3"
      dir="rtl"
    >
      <div className="min-w-0 flex-1 lg:min-w-[220px] lg:max-w-md">
        <label
          htmlFor="list-screen-search"
          className="mb-1.5 block text-start text-xs font-medium text-muted-foreground"
        >
          {t("listScreen.searchLabel")}
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="list-screen-search"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("listScreen.searchPlaceholder")}
            className="h-10 pe-9"
            autoComplete="off"
            dir="rtl"
          />
        </div>
      </div>

      <div className="w-full min-w-[10rem] sm:w-auto">
        <label
          htmlFor="list-screen-date"
          className="mb-1.5 block text-start text-xs font-medium text-muted-foreground"
        >
          {t("listScreen.dateLabel")}
        </label>
        <ListScreenHebrewDatePicker
          id="list-screen-date"
          dateYmd={dateYmd}
          onDateYmdChange={onDateYmdChange}
        />
      </div>

      <div className="w-full min-w-[10rem] sm:w-auto">
        <span className="mb-1.5 block text-start text-xs font-medium text-muted-foreground">
          {t("listScreen.statusLabel")}
        </span>
        <Select
          value={status}
          onValueChange={(v) => onStatusChange(v as ListStatusFilter)}
        >
          <SelectTrigger
            className={listFilterStatusSelectClassName(status)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("listScreen.statusAll")}</SelectItem>
            <SelectItem value="in_progress">
              {t("listScreen.statusNotApproved")}
            </SelectItem>
            <SelectItem value="complete">{t("listScreen.statusApproved")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full shrink-0 items-end sm:w-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full min-w-[9rem] gap-2 sm:w-auto"
          disabled={!hasActiveFilters}
          onClick={onReset}
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
          {t("listScreen.reset")}
        </Button>
      </div>
    </div>
  );
}
