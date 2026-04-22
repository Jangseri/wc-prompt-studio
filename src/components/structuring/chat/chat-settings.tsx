"use client";

import { useStructuringStore } from "@/stores/structuring-store";

export function ChatSettings() {
  const chatSettings = useStructuringStore((s) => s.chatSettings);
  const setChatSettings = useStructuringStore((s) => s.setChatSettings);

  return (
    <div className="border-b border-border bg-muted/50 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Temperature
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={chatSettings.temperature}
            onChange={(e) => setChatSettings({ temperature: parseFloat(e.target.value) })}
            className="w-full accent-primary"
          />
          <span className="text-xs text-muted-foreground">{chatSettings.temperature}</span>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Max Tokens
          </label>
          <input
            type="number"
            value={chatSettings.maxTokens}
            onChange={(e) =>
              setChatSettings({ maxTokens: parseInt(e.target.value) || 1024 })
            }
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
