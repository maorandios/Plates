"use client";

import { useMemo, type CSSProperties } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

function parseLocalYmd(ymd: string): Date | undefined {
  const s = ymd.trim();
  if (!s) return undefined;
  const parts = s.split("-").map(Number);
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts;
  if (!y || !m || !d) return undefined;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt;
}

function toLocalYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface ListScreenHebrewDatePickerProps {
  dateYmd: string;
  onDateYmdChange: (ymd: string) => void;
  id?: string;
}

export function ListScreenHebrewDatePicker({
  dateYmd,
  onDateYmdChange,
  id,
}: ListScreenHebrewDatePickerProps) {
  const selected = useMemo(() => parseLocalYmd(dateYmd), [dateYmd]);

  const labelText = useMemo(() => {
    if (!selected) return t("listScreen.datePlaceholder");
    try {
      return format(selected, "PPP", { locale: he });
    } catch {
      return dateYmd;
    }
  }, [selected, dateYmd]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full min-w-[11rem] justify-between gap-2 border-white/[0.12] bg-background px-3 font-normal text-start sm:w-[14rem]",
            !selected && "text-muted-foreground"
          )}
          aria-label={t("listScreen.dateLabel")}
        >
          <span className="truncate">{labelText}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border border-white/10 bg-popover p-0 text-popover-foreground shadow-xl"
        align="start"
        dir="rtl"
      >
        <div
          className="rounded-md p-3"
          style={
            {
              "--rdp-accent-color": "#6A23F7",
              "--rdp-accent-background-color": "rgba(106, 35, 247, 0.18)",
            } as CSSProperties
          }
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (!d) {
                onDateYmdChange("");
                return;
              }
              onDateYmdChange(toLocalYmd(d));
            }}
            locale={he}
            dir="rtl"
            captionLayout="dropdown"
            fromYear={2020}
            toYear={2035}
            defaultMonth={selected ?? new Date()}
          />
          {selected ? (
            <div className="border-t border-white/10 pt-2">
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => onDateYmdChange("")}
              >
                {t("listScreen.clearDate")}
              </button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
