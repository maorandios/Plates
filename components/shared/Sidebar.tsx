"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  PlusCircle,
  ChevronRight,
  Scissors,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Batches",
    href: "/batches",
    icon: Layers,
  },
  {
    label: "New Batch",
    href: "/batches/new",
    icon: PlusCircle,
  },
  {
    label: "Preferences",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0"
      style={{ backgroundColor: "hsl(var(--sidebar-bg))" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
          <Scissors className="h-4 w-4 text-white" />
        </div>
        <span className="text-white font-semibold text-lg tracking-tight">
          PLATE
        </span>
        <span className="ml-auto text-xs font-medium text-white/40 bg-white/10 px-1.5 py-0.5 rounded">
          MVP
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
              {isActive && (
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-white/40" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-xs text-white/30">Phase 1 · Foundation</p>
      </div>
    </aside>
  );
}
