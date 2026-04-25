import type { ReactNode } from "react";

/** Fills the app shell area below the top bar so the page can be non-scrolling and height-constrained. */
export default function BillAndUsageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="box-border flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
