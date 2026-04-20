"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { usePlateTheme } from "@/components/theme/ThemeProvider";
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

/** Nav tabs: soft surface, rounded corners (not pills) — same look for all */
const navItemBase =
  "inline-flex h-9 max-w-full min-w-0 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium leading-none tracking-tight transition-colors";

const navItemIdle =
  "border-transparent bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground";

/** Selected: purple outline + small purple indicator dot */
const navItemActive =
  "border-primary bg-primary/[0.06] text-foreground shadow-none ring-1 ring-primary/20";

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
  const { theme, setTheme, mounted: themeMounted } = usePlateTheme();

  return (
    <header className="sticky top-0 z-50 w-full shrink-0 bg-transparent">
      <div className="flex min-h-14 w-full max-w-none flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 lg:px-6">
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
                  {active ? <NavActiveDot /> : null}
                  {t(labelKey)}
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
                  {settingsActive ? <NavActiveDot /> : null}
                  <span className="min-w-0 truncate">{t("nav.settings")}</span>
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0 opacity-60"
                    aria-hidden
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[14rem]">
                  {SETTINGS_LINKS.map(({ labelKey, href }) => (
                    <DropdownMenuItem key={href} asChild>
                      <Link href={href} className="cursor-pointer">
                        {t(labelKey)}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div
                    className="flex items-center justify-between gap-3 px-2 py-2.5"
                    dir="rtl"
                  >
                    <span
                      className={cn(
                        "text-sm",
                        themeMounted && theme === "dark"
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {t("theme.appearanceDark")}
                    </span>
                    <Switch
                      checked={themeMounted && theme === "light"}
                      onCheckedChange={(on) => setTheme(on ? "light" : "dark")}
                      disabled={!themeMounted}
                      aria-label={t("theme.appearanceToggleAria")}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        themeMounted && theme === "light"
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {t("theme.appearanceLight")}
                    </span>
                  </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        {/* RTL: second cluster → inline-start (left); logout */}
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-xl border border-border/60 bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            aria-label={t("layout.logoutAria")}
            title={t("layout.logout")}
            onClick={() => {}}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
