import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  /** Optional icon shown before the title (e.g. section affordance). */
  titleIcon?: LucideIcon;
  description?: ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  titleIcon: TitleIcon,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
          {TitleIcon && (
            <TitleIcon
              className="h-7 w-7 shrink-0 text-muted-foreground"
              aria-hidden
              strokeWidth={1.75}
            />
          )}
          {title}
        </h1>
        {description && (
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
