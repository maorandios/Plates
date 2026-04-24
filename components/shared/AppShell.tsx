"use client";

import { usePathname } from "next/navigation";
import { AppTopBar } from "@/components/shared/AppTopBar";

function isAuthFullView(path: string) {
  return (
    path === "/login" ||
    path === "/onboarding" ||
    path.startsWith("/onboarding/")
  );
}

type AppShellProps = {
  children: React.ReactNode;
};

/**
 * Hides the main top bar and uses full viewport for auth routes; otherwise shows the app chrome.
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const fullView = isAuthFullView(pathname);

  if (fullView) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <>
      <AppTopBar />
      <div
        id="app-shell-scroll"
        className="flex min-h-0 min-w-0 w-full max-w-none flex-1 flex-col overflow-auto"
      >
        {children}
      </div>
    </>
  );
}
