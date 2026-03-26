import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /**
   * When true, only padding is applied (no flex-1 / overflow). Use inside a parent
   * that owns vertical scrolling — e.g. batch process layout.
   */
  embedded?: boolean;
}

export function PageContainer({
  children,
  className,
  embedded,
}: PageContainerProps) {
  const Comp = embedded ? "div" : "main";
  return (
    <Comp
      className={cn(
        embedded ? "" : "flex-1 min-h-0 overflow-auto",
        "p-6 lg:p-8",
        className
      )}
    >
      {children}
    </Comp>
  );
}
