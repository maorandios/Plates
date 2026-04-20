"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BottomLoadingIndicator } from "@/components/shared/BottomLoadingIndicator";

/** Min time the pill stays visible on each route change (client navigation). */
const ROUTE_LOADING_PILL_MS = 900;

type Ctx = {
  /** Show or hide the bottom loading pill (e.g. long async work without a route change) */
  setLoading: (visible: boolean) => void;
};

const LoadingBadgeContext = createContext<Ctx | null>(null);

export function LoadingBadgeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const setLoading = useCallback((visible: boolean) => {
    setOpen(visible);
  }, []);

  // Show the pill on every client-side URL change (all screens), not only `/`.
  useEffect(() => {
    setOpen(true);
    const id = window.setTimeout(() => setOpen(false), ROUTE_LOADING_PILL_MS);
    return () => window.clearTimeout(id);
  }, [pathname]);

  const value = useMemo(() => ({ setLoading }), [setLoading]);

  return (
    <LoadingBadgeContext.Provider value={value}>
      {children}
      <BottomLoadingIndicator open={open} />
    </LoadingBadgeContext.Provider>
  );
}

export function useLoadingBadge(): Ctx {
  const ctx = useContext(LoadingBadgeContext);
  if (!ctx) {
    throw new Error("useLoadingBadge must be used within LoadingBadgeProvider");
  }
  return ctx;
}
