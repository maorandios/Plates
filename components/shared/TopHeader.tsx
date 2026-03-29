"use client";

import { usePathname } from "next/navigation";
import { Menu, Scissors } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/quick-quote": "Quote",
  "/settings": "Settings",
  "/settings/account": "Account settings",
  "/settings/units": "Unit system",
  "/settings/materials": "Materials configuration",
  "/settings/bill-and-usage": "Bill and usage",
  "/clients": "Clients",
};

function getPageLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  if (pathname.startsWith("/quick-quote")) return "Quote";
  if (pathname.match(/\/clients\//)) return "Client";
  if (pathname.startsWith("/settings/")) {
    const seg = pathname.replace(/\/$/, "").split("/")[2];
    if (seg === "account") return "Account settings";
    if (seg === "units") return "Unit system";
    if (seg === "materials") return "Materials configuration";
    if (seg === "bill-and-usage") return "Bill and usage";
  }
  return "PLATE";
}

export function TopHeader() {
  const pathname = usePathname();
  const label = getPageLabel(pathname);

  // Hide header for quick-quote route (has its own sticky progress bar)
  if (pathname.startsWith("/quick-quote")) {
    return null;
  }

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10 flex items-center px-4 lg:px-6 gap-4">
      {/* Mobile logo */}
      <div className="flex items-center gap-2 md:hidden">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: "hsl(var(--sidebar-bg))" }}
        >
          <Scissors className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-semibold text-sm">PLATE</span>
      </div>

      <div className="flex-1">
        <span className="text-sm font-medium text-muted-foreground hidden md:block">
          {label}
        </span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
          U
        </div>
      </div>
    </header>
  );
}
