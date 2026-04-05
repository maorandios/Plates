"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ChevronRight,
  Scissors,
  Settings,
  ContactRound,
  FileText,
  ClipboardList,
  UserCircle,
  Layers,
  ChevronDown,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SETTINGS_SUB = [
  {
    label: "Account settings",
    href: "/settings/account",
    icon: UserCircle,
  },
  {
    label: "Materials configuration",
    href: "/settings/materials",
    icon: Layers,
  },
  {
    label: "Bill and usage",
    href: "/settings/bill-and-usage",
    icon: Receipt,
  },
] as const;

const mainNavItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Quotes",
    href: "/quotes",
    icon: ClipboardList,
  },
  {
    label: "Quote",
    href: "/quick-quote",
    icon: FileText,
  },
  {
    label: "Clients",
    href: "/clients",
    icon: ContactRound,
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const onSettingsRoute = pathname.startsWith("/settings");
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  useEffect(() => {
    if (!onSettingsRoute) {
      setSettingsMenuOpen(false);
    }
  }, [onSettingsRoute]);

  const settingsExpanded = onSettingsRoute || settingsMenuOpen;

  function toggleSettingsMenu() {
    if (onSettingsRoute) return;
    setSettingsMenuOpen((v) => !v);
  }

  return (
    <aside className="sticky top-0 hidden h-svh min-h-0 w-60 shrink-0 flex-col border-r border-white/[0.06] bg-sidebar-bg md:flex">
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
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {mainNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/quotes"
                ? pathname === "/quotes" || pathname.startsWith("/quotes/")
                : item.href === "/quick-quote"
                  ? pathname === "/quick-quote" || pathname.startsWith("/quick-quote/")
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

        {/* Settings with expandable sub-menu */}
        <div className="pt-0.5">
          <div
            className={cn(
              "flex items-center gap-1 rounded-lg",
              onSettingsRoute ? "bg-white/15" : "hover:bg-white/8"
            )}
          >
            <Link
              href="/settings/account"
              className={cn(
                "flex flex-1 min-w-0 items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                onSettingsRoute
                  ? "text-white"
                  : "text-white/60 hover:text-white"
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="truncate">Settings</span>
              {onSettingsRoute && (
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-white/40 shrink-0" />
              )}
            </Link>
            <button
              type="button"
              onClick={toggleSettingsMenu}
              className={cn(
                "shrink-0 p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors",
                onSettingsRoute && "opacity-50 pointer-events-none"
              )}
              aria-expanded={settingsExpanded}
              aria-label={settingsExpanded ? "Collapse settings menu" : "Expand settings menu"}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  settingsExpanded ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
          </div>

          {settingsExpanded && (
            <div className="mt-0.5 ml-2 pl-2 border-l border-white/15 space-y-0.5">
              {SETTINGS_SUB.map((sub) => {
                const subActive =
                  pathname === sub.href || pathname.startsWith(sub.href + "/");
                return (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      subActive
                        ? "bg-white/12 text-white"
                        : "text-white/55 hover:text-white hover:bg-white/8"
                    )}
                  >
                    <sub.icon className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={1.75} />
                    <span className="truncate">{sub.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-xs text-white/30">Quotation MVP</p>
      </div>
    </aside>
  );
}
