import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  RegionId,
  StructuringPrompt,
  TargetLLM,
  KeyValueItem,
  CustomSectionItem,
  BranchingStep,
} from "@/types/structuring";
import type { ChatMessage, ChatSettings } from "@/types/chat";

export type RightPanelView = "preview" | "chat";

const emptyPrompt = (): StructuringPrompt => ({
  role: { content: "" },
  persona: { language: "", tone: "" },
  companyInfo: { description: "", greeting: "" },
  answerScope: {
    rag: { enabled: false, performanceNotes: "" },
    specifics: { type: "keyValue", keyValueItems: [], sentence: "" },
  },
  branching: { topLevelRules: [], steps: [] },
  toolCalling: { mcp: "", api: "", agent: "", dataQuery: "" },
  system: { rules: "" },
  conversation: {
    rules: {
      rejectOutOfScope: false,
      noReAskCollected: false,
      oneQuestionAtATime: false,
      noInference: false,
      restrictedInfoOnly: false,
    },
    customNotes: "",
  },
  custom: { items: [] },
});

// Regions that auto-expand after `setAll` (i.e. when a draft is generated).
// toolCalling is intentionally excluded — the feature isn't ready yet and
// the card starts collapsed so users aren't tempted to use it.
// Order mirrors REGION_ORDER.
const DEFAULT_EXPANDED_REGIONS: RegionId[] = [
  "role",
  "persona",
  "companyInfo",
  "system",
  "conversation",
  "branching",
  "custom",
  "answerScope",
];

// Regions expanded by the "모두 펼치기" action — includes everything so
// users can still inspect the disabled toolCalling card if they want.
const ALL_REGIONS: RegionId[] = [
  "role",
  "persona",
  "companyInfo",
  "system",
  "conversation",
  "toolCalling",
  "branching",
  "custom",
  "answerScope",
];

interface StructuringStore {
  prompt: StructuringPrompt;
  /**
   * 소비자(Preview, Chat, Apply)에게 노출되는 스냅샷. Regions 에서
   * 편집하는 동안 `prompt` 와 갈라져 있다가, "적용" 버튼이
   * `applyDraft()` 를 호출하면 `prompt` 를 그대로 가져와 같은 ref 로
   * 맞춤. dirty 감지는 `prompt !== publishedPrompt` 의 reference
   * equality 로 — region updater 는 모두 spread 로 새 객체를 만들고,
   * `applyDraft` 와 `setAll` 만 두 필드를 같은 ref 로 맞추기 때문.
   */
  publishedPrompt: StructuringPrompt;
  expandedRegions: Set<RegionId>;
  targetLLM: TargetLLM;

  // Right panel view
  rightPanelView: RightPanelView;
  setRightPanelView: (view: RightPanelView) => void;

  // Chat state
  chatMessages: ChatMessage[];
  chatSettings: ChatSettings;
  isChatLoading: boolean;
  addChatMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearChat: () => void;
  setChatSettings: (patch: Partial<ChatSettings>) => void;
  setIsChatLoading: (v: boolean) => void;

  // Region updaters
  updateRegion: <K extends RegionId>(
    id: K,
    updater: (current: StructuringPrompt[K]) => StructuringPrompt[K]
  ) => void;
  /** Replace the entire prompt payload (used when /api/generate mode=regions returns a draft). */
  setAll: (prompt: StructuringPrompt) => void;
  /** 현재 `prompt` 를 `publishedPrompt` 로 복사해서 Preview/Chat/Apply
   *  에 반영. 변경 없으면 no-op. */
  applyDraft: () => void;
  toggleRegion: (id: RegionId) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setTargetLLM: (target: TargetLLM) => void;

  addKeyValueItem: () => void;
  updateKeyValueItem: (id: string, patch: Partial<Omit<KeyValueItem, "id">>) => void;
  removeKeyValueItem: (id: string) => void;

  addCustomSection: () => void;
  updateCustomSection: (
    id: string,
    patch: Partial<Omit<CustomSectionItem, "id">>
  ) => void;
  removeCustomSection: (id: string) => void;

  /* ── Branching: top-level rules ── */
  addBranchingRule: () => void;
  updateBranchingRule: (index: number, text: string) => void;
  removeBranchingRule: (index: number) => void;

  /* ── Branching: ordered steps ── */
  addBranchingStep: () => void;
  updateBranchingStep: (
    id: string,
    patch: Partial<Omit<BranchingStep, "id">>
  ) => void;
  removeBranchingStep: (id: string) => void;
  moveBranchingStep: (id: string, direction: "up" | "down") => void;

  reset: () => void;
}

export const useStructuringStore = create<StructuringStore>((set, get) => ({
  prompt: emptyPrompt(),
  publishedPrompt: emptyPrompt(),
  expandedRegions: new Set<RegionId>(),
  targetLLM: "gpt",

  rightPanelView: "preview",
  setRightPanelView: (view) => set({ rightPanelView: view }),

  chatMessages: [],
  chatSettings: { temperature: 0.25, maxTokens: 1024 },
  isChatLoading: false,
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  updateLastAssistantMessage: (content) =>
    set((state) => {
      const messages = [...state.chatMessages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        messages[lastIdx] = { ...messages[lastIdx], content };
      }
      return { chatMessages: messages };
    }),
  // Only clears real user/assistant messages; the greeting is rendered
  // virtually in ChatWindow from `prompt.companyInfo.greeting` and stays
  // visible.
  clearChat: () => set({ chatMessages: [] }),
  setChatSettings: (patch) =>
    set((state) => ({ chatSettings: { ...state.chatSettings, ...patch } })),
  setIsChatLoading: (v) => set({ isChatLoading: v }),

  updateRegion: (id, updater) =>
    set((state) => ({
      prompt: { ...state.prompt, [id]: updater(state.prompt[id]) },
    })),

  // 초안 생성 직후엔 dirty 가 아니어야 하므로 prompt 와 publishedPrompt
  // 를 같은 ref 로 맞춰서 시작.
  setAll: (prompt) =>
    set({
      prompt,
      publishedPrompt: prompt,
      expandedRegions: new Set<RegionId>(DEFAULT_EXPANDED_REGIONS),
    }),

  applyDraft: () =>
    set((state) => ({ publishedPrompt: state.prompt })),

  toggleRegion: (id) =>
    set((state) => {
      const next = new Set(state.expandedRegions);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedRegions: next };
    }),

  expandAll: () =>
    set(() => ({
      expandedRegions: new Set<RegionId>(ALL_REGIONS),
    })),

  collapseAll: () => set({ expandedRegions: new Set<RegionId>() }),

  setTargetLLM: (target) => set({ targetLLM: target }),

  addKeyValueItem: () =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        answerScope: {
          ...state.prompt.answerScope,
          specifics: {
            ...state.prompt.answerScope.specifics,
            keyValueItems: [
              ...state.prompt.answerScope.specifics.keyValueItems,
              { id: nanoid(), key: "", value: "" },
            ],
          },
        },
      },
    })),

  updateKeyValueItem: (id, patch) =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        answerScope: {
          ...state.prompt.answerScope,
          specifics: {
            ...state.prompt.answerScope.specifics,
            keyValueItems: state.prompt.answerScope.specifics.keyValueItems.map((item) =>
              item.id === id ? { ...item, ...patch } : item
            ),
          },
        },
      },
    })),

  removeKeyValueItem: (id) =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        answerScope: {
          ...state.prompt.answerScope,
          specifics: {
            ...state.prompt.answerScope.specifics,
            keyValueItems: state.prompt.answerScope.specifics.keyValueItems.filter(
              (item) => item.id !== id
            ),
          },
        },
      },
    })),

  addCustomSection: () =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        custom: {
          items: [
            ...state.prompt.custom.items,
            { id: nanoid(), tag: "", content: "" },
          ],
        },
      },
    })),

  updateCustomSection: (id, patch) =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        custom: {
          items: state.prompt.custom.items.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          ),
        },
      },
    })),

  removeCustomSection: (id) =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        custom: {
          items: state.prompt.custom.items.filter((item) => item.id !== id),
        },
      },
    })),

  addBranchingRule: () =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        branching: {
          ...state.prompt.branching,
          topLevelRules: [...state.prompt.branching.topLevelRules, ""],
        },
      },
    })),

  updateBranchingRule: (index, text) =>
    set((state) => {
      const rules = state.prompt.branching.topLevelRules;
      if (index < 0 || index >= rules.length) return state;
      const next = rules.slice();
      next[index] = text;
      return {
        prompt: {
          ...state.prompt,
          branching: { ...state.prompt.branching, topLevelRules: next },
        },
      };
    }),

  removeBranchingRule: (index) =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        branching: {
          ...state.prompt.branching,
          topLevelRules: state.prompt.branching.topLevelRules.filter(
            (_, i) => i !== index
          ),
        },
      },
    })),

  addBranchingStep: () =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        branching: {
          ...state.prompt.branching,
          steps: [
            ...state.prompt.branching.steps,
            { id: nanoid(), title: "", body: "" },
          ],
        },
      },
    })),

  updateBranchingStep: (id, patch) =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        branching: {
          ...state.prompt.branching,
          steps: state.prompt.branching.steps.map((step) =>
            step.id === id ? { ...step, ...patch } : step
          ),
        },
      },
    })),

  removeBranchingStep: (id) =>
    set((state) => ({
      prompt: {
        ...state.prompt,
        branching: {
          ...state.prompt.branching,
          steps: state.prompt.branching.steps.filter((step) => step.id !== id),
        },
      },
    })),

  moveBranchingStep: (id, direction) =>
    set((state) => {
      const steps = state.prompt.branching.steps;
      const idx = steps.findIndex((s) => s.id === id);
      if (idx < 0) return state;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= steps.length) return state;
      const next = steps.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return {
        prompt: {
          ...state.prompt,
          branching: { ...state.prompt.branching, steps: next },
        },
      };
    }),

  reset: () => {
    const fresh = emptyPrompt();
    set({
      prompt: fresh,
      publishedPrompt: fresh,
      expandedRegions: new Set<RegionId>(),
      chatMessages: [],
    });
  },
}));
