"use client";

import { RegionGrid } from "./region-grid";
import { PreviewPanel } from "./preview-panel";

export default function StructuringTab() {
  return (
    <main className="flex-1 min-h-0 p-6">
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]">
        <div className="min-h-0 overflow-auto pr-1">
          <RegionGrid />
        </div>
        <div className="min-h-0 lg:h-[calc(100vh-8rem)]">
          <PreviewPanel />
        </div>
      </div>
    </main>
  );
}
