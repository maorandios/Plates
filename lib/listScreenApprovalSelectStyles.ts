import { cn } from "@/lib/utils";
import type { ListStatusFilter } from "@/lib/listScreenFilters";

/**
 * Emerald / orange chips — match NestingPreviewSection usage + job overview cards
 * (light: soft fill + border; dark: slightly stronger fill).
 */
const APPROVED_TINT =
  "border border-emerald-500/35 !bg-emerald-500/12 !text-[#14765F] shadow-none hover:!bg-emerald-500/16 focus:!ring-2 focus:!ring-emerald-500/35 focus:ring-offset-0 focus:ring-offset-background [&>span]:!text-[#14765F] data-[state=open]:!ring-2 data-[state=open]:!ring-emerald-500/35 dark:border-emerald-500/30 dark:!bg-emerald-500/20 dark:!text-[#14765F] dark:hover:!bg-emerald-500/25 dark:[&>span]:!text-[#14765F]";

const PENDING_TINT =
  "border border-orange-500/40 !bg-orange-500/12 !text-[#FF4C00] shadow-none hover:!bg-orange-500/16 focus:!ring-2 focus:!ring-orange-500/35 focus:ring-offset-0 focus:ring-offset-background [&>span]:!text-[#FF4C00] data-[state=open]:!ring-2 data-[state=open]:!ring-orange-500/35 dark:border-orange-500/35 dark:!bg-orange-500/18 dark:!text-[#FF4C00] dark:hover:!bg-orange-500/22 dark:[&>span]:!text-[#FF4C00]";

const ROW_TRIGGER_LAYOUT =
  "h-7 min-h-7 w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem] shrink-0 gap-0.5 overflow-hidden rounded-full px-1.5 text-[11px] font-medium leading-none [&>span]:min-w-0 [&>span]:max-w-full [&>span]:flex-1 [&>span]:truncate [&>span]:text-center [&>span]:leading-none flex items-center justify-between [&_svg]:h-3 [&_svg]:w-3 [&_svg]:shrink-0 [&_svg]:opacity-80";

/** Status cell dropdown on quotes / projects tables */
export function listRowApprovalSelectClassName(
  status: "complete" | "in_progress"
): string {
  return cn(
    ROW_TRIGGER_LAYOUT,
    status === "complete" ? APPROVED_TINT : PENDING_TINT
  );
}

const FILTER_TRIGGER_LAYOUT = "h-10 w-full min-w-[9rem] sm:w-[11rem]";

/** Filter bar “סטטוס” when filtered by approval */
export function listFilterStatusSelectClassName(status: ListStatusFilter): string {
  if (status === "all") return FILTER_TRIGGER_LAYOUT;
  return cn(
    FILTER_TRIGGER_LAYOUT,
    status === "complete" ? APPROVED_TINT : PENDING_TINT
  );
}
