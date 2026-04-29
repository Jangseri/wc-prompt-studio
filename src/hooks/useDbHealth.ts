import { useEffect } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { apiPath } from "@/lib/api-path";

/**
 * Polls /api/health every 30s and writes the result into editor-store
 * so the header's DB status pill stays current. Mounted once at the
 * layout level via `<DbHealthPoller />`, which means both `/` (unified
 * workspace) and `/legacy` get the badge updated with no per-route
 * wiring.
 */
export function useDbHealth() {
  const setDbConnected = useEditorStore((s) => s.setDbConnected);
  const setDbReason = useEditorStore((s) => s.setDbReason);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(apiPath("/api/health"), { signal: controller.signal });
        clearTimeout(timer);
        const data = await res.json();
        setDbConnected(data.connected);
        setDbReason(data.reason ?? null);
      } catch {
        setDbConnected(false);
        setDbReason("서버 응답 없음");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [setDbConnected, setDbReason]);
}
