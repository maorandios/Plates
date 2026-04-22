"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PLATE_THEME_STORAGE_KEY,
  type PlateTheme,
} from "@/lib/theme/plateTheme";

type ThemeContextValue = {
  theme: PlateTheme;
  setTheme: (next: PlateTheme) => void;
  /** False until client has read localStorage and synced `html.light` */
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDomTheme(next: PlateTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", next === "light");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<PlateTheme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (() => {
      try {
        const v = window.localStorage.getItem(PLATE_THEME_STORAGE_KEY);
        return v === "light" || v === "dark" ? v : null;
      } catch {
        return null;
      }
    })();
    const initial: PlateTheme = stored ?? "light";
    setThemeState(initial);
    applyDomTheme(initial);
    setMounted(true);
  }, []);

  const setTheme = useCallback((next: PlateTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(PLATE_THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyDomTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, mounted }),
    [theme, setTheme, mounted]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function usePlateTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("usePlateTheme must be used within ThemeProvider");
  }
  return ctx;
}
