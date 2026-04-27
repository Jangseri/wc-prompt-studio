"use client";

import { useDbHealth } from "@/hooks/useDbHealth";

/**
 * Render-nothing client component whose only job is to run the health
 * polling hook from inside `app/layout.tsx`. Keeps the layout itself a
 * server component while still getting one polling loop per page load.
 */
export function DbHealthPoller() {
  useDbHealth();
  return null;
}
