import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  RegionId,
  StructuringPrompt,
  TargetLLM,
  KeyValueItem,
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
  branching: { description: "", pseudoCode: "" },
  toolCalling: { mcp: "", api: "", agent: "", dataQuery: "" },
  system: { sttTts: "" },
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
});

interface StructuringStore {
  prompt: StructuringPrompt;
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
  initChat: () => void;
  setChatSettings: (patch: Partial<ChatSettings>) => void;
  setIsChatLoading: (v: boolean) => void;

  // Region updaters
  updateRegion: <K extends RegionId>(
    id: K,
    updater: (current: StructuringPrompt[K]) => StructuringPrompt[K]
  ) => void;
  toggleRegion: (id: RegionId) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setTargetLLM: (target: TargetLLM) => void;

  addKeyValueItem: () => void;
  updateKeyValueItem: (id: string, patch: Partial<Omit<KeyValueItem, "id">>) => void;
  removeKeyValueItem: (id: string) => void;

  reset: () => void;
}

export const useStructuringStore = create<StructuringStore>((set, get) => ({
  prompt: emptyPrompt(),
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
  clearChat: () => {
    set({ chatMessages: [] });
    get().initChat();
  },
  initChat: () => {
    const state = get();
    if (state.chatMessages.length > 0) return;
    const greeting = state.prompt.companyInfo.greeting.trim();
    if (!greeting) return;
    set({
      chatMessages: [
        {
          id: "greeting",
          role: "assistant",
          content: greeting,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  },
  setChatSettings: (patch) =>
    set((state) => ({ chatSettings: { ...state.chatSettings, ...patch } })),
  setIsChatLoading: (v) => set({ isChatLoading: v }),

  updateRegion: (id, updater) =>
    set((state) => ({
      prompt: { ...state.prompt, [id]: updater(state.prompt[id]) },
    })),

  toggleRegion: (id) =>
    set((state) => {
      const next = new Set(state.expandedRegions);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedRegions: next };
    }),

  expandAll: () =>
    set(() => ({
      expandedRegions: new Set<RegionId>([
        "role",
        "persona",
        "companyInfo",
        "answerScope",
        "branching",
        "toolCalling",
        "system",
        "conversation",
      ]),
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

  reset: () =>
    set({
      prompt: emptyPrompt(),
      expandedRegions: new Set<RegionId>(),
      chatMessages: [],
    }),
}));
