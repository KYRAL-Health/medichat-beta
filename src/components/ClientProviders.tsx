"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark as clerkDarkTheme } from "@clerk/themes";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme | null;
  setTheme: (t: Theme | null) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

function readInitialTheme(): Theme | null {
  try {
    const match = document.cookie.match(/(?:^|; )medichat_theme=([^;]+)/);
    const cookie = match ? decodeURIComponent(match[1]) : null;
    if (cookie === "light") return "light";
    if (cookie === "dark") return "dark";
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  } catch (e) {
    return "light";
  }
}

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    const initial = readInitialTheme();
    setThemeState(initial);
  }, []);

  useEffect(() => {
    if (theme === null) return;
    try {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
      const value = theme === null ? "" : encodeURIComponent(theme);
      document.cookie = `medichat_theme=${value}; path=/; max-age=${60 * 60 * 24 * 365 * 10}; sameSite=Lax`;
      try {
        localStorage.setItem("medichat_theme_sync", String(Date.now()));
      } catch (e) {}
    } catch (e) {}
  }, [theme]);

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "medichat_theme_sync") {
        const match = document.cookie.match(/(?:^|; )medichat_theme=([^;]+)/);
        const cookie = match ? decodeURIComponent(match[1]) : null;
        if (cookie === "dark" || cookie === "light") setThemeState(cookie as Theme);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = (t: Theme | null) => setThemeState(t);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <ClerkProvider appearance={{ theme: theme === "dark" ? clerkDarkTheme : undefined }}>
        {children}
      </ClerkProvider>
    </ThemeContext.Provider>
  );
}
