import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MatchStatus, BatchStatus } from "@/types";

interface MatchStatusBadgeProps {
  status: MatchStatus;
}

export function MatchStatusBadge({ status }: MatchStatusBadgeProps) {
  const config = {
    matched: { label: "Matched", className: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
    unmatched: { label: "Unmatched", className: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100" },
    needs_review: { label: "Review", className: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100" },
  };

  const { label, className } = config[status];

  return (
    <Badge variant="outline" className={cn("text-xs font-medium", className)}>
      {label}
    </Badge>
  );
}

interface BatchStatusBadgeProps {
  status: BatchStatus;
}

export function BatchStatusBadge({ status }: BatchStatusBadgeProps) {
  const config: Record<BatchStatus, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100" },
    active: { label: "Active", className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" },
    completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
    archived: { label: "Archived", className: "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100" },
  };

  const { label, className } = config[status];

  return (
    <Badge variant="outline" className={cn("text-xs font-medium", className)}>
      {label}
    </Badge>
  );
}

interface FileTypeBadgeProps {
  type: "dxf" | "excel";
}

export function FileTypeBadge({ type }: FileTypeBadgeProps) {
  const config = {
    dxf: { label: "DXF", className: "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100" },
    excel: { label: "Excel", className: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" },
  };

  const { label, className } = config[type];

  return (
    <Badge variant="outline" className={cn("text-xs font-medium font-mono", className)}>
      {label}
    </Badge>
  );
}

interface PresenceBadgeProps {
  status: "present" | "missing";
}

export function PresenceBadge({ status }: PresenceBadgeProps) {
  return status === "present" ? (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
      Present
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 inline-block" />
      Missing
    </span>
  );
}
