import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { MatchStatus, BatchStatus } from "@/types";

interface MatchStatusBadgeProps {
  status: MatchStatus;
}

export function MatchStatusBadge({ status }: MatchStatusBadgeProps) {
  const config = {
    matched: {
      label: "Matched",
      className:
        "bg-primary/15 text-primary border-primary/30 hover:bg-primary/20",
    },
    unmatched: {
      label: "Unmatched",
      className: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/20",
    },
    needs_review: {
      label: "Review",
      className: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/20",
    },
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
  const config: Record<BatchStatus, { labelKey: string; className: string }> = {
    draft: {
      labelKey: "status.batchDraft",
      className: "bg-white/[0.06] text-muted-foreground border-white/10 hover:bg-white/[0.08]",
    },
    active: {
      labelKey: "status.batchActive",
      className: "bg-sky-500/15 text-sky-300 border-sky-500/25 hover:bg-sky-500/20",
    },
    completed: {
      labelKey: "status.batchCompleted",
      className: "bg-primary/15 text-primary border-primary/30 hover:bg-primary/20",
    },
    archived: {
      labelKey: "status.batchArchived",
      className: "bg-white/[0.04] text-muted-foreground/80 border-white/10 hover:bg-white/[0.06]",
    },
  };

  const { labelKey, className } = config[status];
  const label = t(labelKey);

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
    dxf: {
      label: "DXF",
      className: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25 hover:bg-indigo-500/20",
    },
    excel: {
      label: "Excel",
      className: "bg-primary/15 text-primary border-primary/30 hover:bg-primary/20",
    },
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
    <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
      Present
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 inline-block" />
      Missing
    </span>
  );
}
