"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppTopBarBack } from "@/lib/appTopBarBack";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

const MAIN_NAV: {
  labelKey: "nav.dashboard" | "nav.quotes" | "nav.projects" | "nav.clients";
  href: string;
}[] = [
  { labelKey: "nav.dashboard", href: "/" },
  { labelKey: "nav.quotes", href: "/quotes" },
  { labelKey: "nav.projects", href: "/projects" },
  { labelKey: "nav.clients", href: "/clients" },
];

const SETTINGS_LINKS: {
  labelKey: "nav.accountSettings" | "nav.materialsConfig" | "nav.billAndUsage";
  href: string;
}[] = [
  { labelKey: "nav.accountSettings", href: "/settings/account" },
  { labelKey: "nav.materialsConfig", href: "/settings/materials" },
  { labelKey: "nav.billAndUsage", href: "/settings/bill-and-usage" },
];

function linkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Main top bar nav pills: fixed width, rounded shell */
const navItemBase =
  "inline-flex h-9 w-44 max-w-full min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-sm font-medium leading-none tracking-tight transition-colors";

const navItemIdle =
  "border-transparent bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground";

/** Selected: tint + dot only — no outer border/ring on the shell */
const navItemActive =
  "border-transparent bg-primary/[0.06] text-foreground shadow-none ring-0";

function NavActiveDot() {
  return (
    <span
      className="size-1.5 shrink-0 rounded-full bg-primary ring-2 ring-primary/35"
      aria-hidden
    />
  );
}

export function AppTopBar() {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/settings");
  const quickQuoteGlass =
    pathname === "/quick-quote" || pathname.startsWith("/quick-quote/");
  const topBarBack = getAppTopBarBack(pathname);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full shrink-0",
        quickQuoteGlass
          ? "qq-glass border-b-0 shadow-none"
          : "bg-transparent"
      )}
    >
      <div className="flex min-h-14 w-full max-w-none flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 py-2.5 lg:px-8">
        {/* RTL: first cluster → inline-end (right); logo + primary nav */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center py-0.5"
            aria-label={t("brand.name")}
          >
            <Image
              src="/mainlogo.svg?v=20260420"
              alt=""
              width={1374}
              height={364}
              priority
              className="h-9 w-auto max-w-[12rem] object-contain object-center sm:h-10 sm:max-w-[14.5rem]"
            />
          </Link>

          <nav
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
            aria-label={t("layout.mainNavAria")}
          >
            {MAIN_NAV.map(({ labelKey, href }) => {
              const active = linkActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    navItemBase,
                    active ? navItemActive : navItemIdle
                  )}
                >
                  <span className="flex min-w-0 w-full items-center justify-center gap-1.5">
                    {active ? <NavActiveDot /> : null}
                    <span className="min-w-0 truncate">{t(labelKey)}</span>
                  </span>
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    navItemBase,
                    settingsActive ? navItemActive : navItemIdle
                  )}
                >
                  <span className="flex min-w-0 w-full items-center justify-center gap-1.5">
                    {settingsActive ? <NavActiveDot /> : null}
                    <span className="min-w-0 flex-1 truncate">
                      {t("nav.settings")}
                    </span>
                    <ChevronDown
                      className="h-3.5 w-3.5 shrink-0 opacity-60"
                      aria-hidden
                    />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[12.5rem] overflow-hidden rounded-xl border border-border bg-card p-1.5 text-foreground shadow-sm"
              >
                {SETTINGS_LINKS.map(({ labelKey, href }) => (
                  <DropdownMenuItem
                    key={href}
                    asChild
                    className="cursor-pointer rounded-lg p-0 data-[highlighted]:bg-primary/[0.08] data-[highlighted]:text-foreground"
                  >
                    <Link
                      href={href}
                      className="block w-full px-3 py-2.5 text-sm font-medium"
                    >
                      {t(labelKey)}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        {/* RTL: second cluster → inline-start (left); back to parent list when applicable */}
        {topBarBack ? (
          <div className="flex shrink-0 items-center">
            <Button
              size="sm"
              asChild
              className="h-9 max-w-[min(100%,14rem)] border-0 bg-zinc-700 px-3 text-white shadow-sm hover:bg-zinc-800 hover:text-white sm:max-w-none"
            >
              <Link
                href={topBarBack.href}
                className="gap-1.5"
                aria-label={t(topBarBack.labelKey)}
              >
                <span className="min-w-0 truncate text-xs font-medium sm:text-sm">
                  {t(topBarBack.labelKey)}
                </span>
                <ArrowLeft className="h-4 w-4 shrink-0 text-white" aria-hidden />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
