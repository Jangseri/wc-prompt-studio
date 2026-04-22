import { create } from "zustand";
import type { CstmPrmtInfo, KBItem } from "@/types/editor";

export type SidebarTab = "prompt" | "kb";

interface EditorStore {
  // Prompt list
  items: CstmPrmtInfo[];
  selectedItem: CstmPrmtInfo | null;
  loading: boolean;
  isCreateMode: boolean;
  searchedCompanySeq: string;

  // Sidebar tab
  activeTab: SidebarTab;

  // KB
  kbItems: KBItem[];
  selectedKB: KBItem | null;
  kbLoading: boolean;

  // DB connection
  dbConnected: boolean | null;
  dbReason: string | null;

  // Actions
  setItems: (items: CstmPrmtInfo[]) => void;
  setSelectedItem: (item: CstmPrmtInfo | null) => void;
  setLoading: (v: boolean) => void;
  setIsCreateMode: (v: boolean) => void;
  setSearchedCompanySeq: (seq: string) => void;
  setActiveTab: (tab: SidebarTab) => void;
  setKbItems: (items: KBItem[]) => void;
  setSelectedKB: (item: KBItem | null) => void;
  setKbLoading: (v: boolean) => void;
  setDbConnected: (v: boolean | null) => void;
  setDbReason: (v: string | null) => void;

  // Compound actions
  handleSelect: (item: CstmPrmtInfo) => void;
  handleCreate: () => void;
  handleCreated: (created: CstmPrmtInfo) => void;
  handleSaved: (updated: CstmPrmtInfo) => void;
  handleDeleted: (id: number) => void;
  handleReset: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  items: [],
  selectedItem: null,
  loading: false,
  isCreateMode: false,
  searchedCompanySeq: "",

  activeTab: "prompt",

  kbItems: [],
  selectedKB: null,
  kbLoading: false,

  dbConnected: null,
  dbReason: null,

  setItems: (items) => set({ items }),
  setSelectedItem: (item) => set({ selectedItem: item }),
  setLoading: (v) => set({ loading: v }),
  setIsCreateMode: (v) => set({ isCreateMode: v }),
  setSearchedCompanySeq: (seq) => set({ searchedCompanySeq: seq }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setKbItems: (items) => set({ kbItems: items }),
  setSelectedKB: (item) => set({ selectedKB: item }),
  setKbLoading: (v) => set({ kbLoading: v }),
  setDbConnected: (v) => set({ dbConnected: v }),
  setDbReason: (v) => set({ dbReason: v }),

  handleSelect: (item) => set({ selectedItem: item, isCreateMode: false }),
  handleCreate: () => set({ selectedItem: null, isCreateMode: true }),
  handleCreated: (created) =>
    set((state) => ({
      items: [created, ...state.items],
      selectedItem: created,
      isCreateMode: false,
    })),
  handleSaved: (updated) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.cstm_id === updated.cstm_id ? updated : item
      ),
      selectedItem: updated,
    })),
  handleDeleted: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.cstm_id !== id),
      selectedItem: null,
    })),
  handleReset: () =>
    set({
      items: [],
      selectedItem: null,
      isCreateMode: false,
      searchedCompanySeq: "",
      kbItems: [],
      selectedKB: null,
    }),
}));
