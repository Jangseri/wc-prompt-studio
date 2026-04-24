"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/**
 * Sonner toaster that follows the current theme via next-themes.
 * Previously this lived inline in `app/layout.tsx` with hardcoded
 * dark colors, which didn't invert on light mode. Now we forward
 * next-themes' `resolvedTheme` to Sonner's `theme` prop so it picks
 * its own light/dark palette.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const theme =
    resolvedTheme === "light" || resolvedTheme === "dark"
      ? resolvedTheme
      : "dark";
  return <Toaster position="bottom-right" theme={theme} richColors closeButton />;
}
