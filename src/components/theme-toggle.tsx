"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Sun/Moon toggle. Renders a placeholder on the server + initial client
 * render to avoid hydration mismatches; the actual theme swaps once
 * `useTheme` reports `mounted`.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={isDark ? "라이트 모드" : "다크 모드"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground",
        className
      )}
    >
      {/* Both icons are rendered stacked so the first paint (pre-mount)
       *  is stable; opacity swap avoids layout shift. */}
      <Sun
        className={cn(
          "h-3.5 w-3.5 transition-opacity",
          isDark ? "opacity-0 absolute" : "opacity-100"
        )}
      />
      <Moon
        className={cn(
          "h-3.5 w-3.5 transition-opacity",
          isDark ? "opacity-100" : "opacity-0 absolute"
        )}
      />
    </button>
  );
}
