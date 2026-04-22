import { create } from "zustand";

export type MainTab = "auto" | "editor" | "structuring";

interface UIStore {
  activeMainTab: MainTab;
  setActiveMainTab: (tab: MainTab) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeMainTab: "auto",
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),
}));
