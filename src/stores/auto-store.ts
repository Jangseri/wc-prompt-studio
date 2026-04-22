import { create } from "zustand";
import type { ParsedFile, UploadResult } from "@/types/upload";
import type { GeneratedPrompt, PromptSections } from "@/types/prompt";
import type { ChatMessage, ChatSettings, DummyData } from "@/types/chat";

type Step = "upload" | "edit" | "chat";

export interface ImproveRecord {
  id: string;
  timestamp: string;
  feedback: string;
  summary: string;
  beforeText: string;
  afterText: string;
}

interface AutoStore {
  // Step management
  currentStep: Step;
  setCurrentStep: (step: Step) => void;

  // Upload state
  uploadedFiles: File[];
  parsedFiles: ParsedFile[];
  uploadResult: UploadResult | null;
  isUploading: boolean;
  isParsing: boolean;
  detectedType: "hospital" | "general";
  channelType: "callbot" | "chatbot";
  setUploadedFiles: (files: File[]) => void;
  setParsedFiles: (files: ParsedFile[]) => void;
  setUploadResult: (result: UploadResult | null) => void;
  setIsUploading: (v: boolean) => void;
  setIsParsing: (v: boolean) => void;
  setDetectedType: (type: "hospital" | "general") => void;
  setChannelType: (type: "callbot" | "chatbot") => void;

  // Parsed data (editable before generation)
  parsedTextContent: string;
  parsedImageDescriptions: string[];
  usedImageDescriptions: string[];
  showParsedReview: boolean;
  setParsedTextContent: (text: string) => void;
  setParsedImageDescriptions: (descs: string[]) => void;
  setUsedImageDescriptions: (descs: string[]) => void;
  setShowParsedReview: (v: boolean) => void;

  // Prompt state
  generatedPrompt: GeneratedPrompt | null;
  editedFullText: string;
  previousPromptText: string;
  isGenerating: boolean;
  setGeneratedPrompt: (prompt: GeneratedPrompt | null) => void;
  setEditedFullText: (text: string) => void;
  setEditedFullTextWithDiff: (text: string) => void;
  clearPreviousPromptText: () => void;
  setIsGenerating: (v: boolean) => void;

  // Improve history
  improveHistory: ImproveRecord[];
  addImproveRecord: (record: ImproveRecord) => void;

  // Chat state
  chatMessages: ChatMessage[];
  chatSettings: ChatSettings;
  dummyData: DummyData;
  greetingMessage: string;
  isChatLoading: boolean;
  setGreetingMessage: (msg: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  setChatSettings: (settings: Partial<ChatSettings>) => void;
  setDummyData: (data: Partial<DummyData>) => void;
  setIsChatLoading: (v: boolean) => void;
  initChat: () => void;
  clearChat: () => void;

  // Reset
  resetAll: () => void;
}

const initialDummyData: DummyData = {
  aa2001: '{"company": "테스트 업체", "phone": "1588-0000"}',
  aa2002: '{"name": "홍길동", "phone": "010-1234-5678"}',
  aa2003: '{"진료과1": "open", "진료과2": "closed"}',
  aa1000: "Q: 영업시간이 어떻게 되나요?\nA: 평일 09:00~18:00 운영합니다.",
};

export const useAutoStore = create<AutoStore>((set) => ({
  currentStep: "upload",
  setCurrentStep: (step) => set({ currentStep: step }),

  uploadedFiles: [],
  parsedFiles: [],
  uploadResult: null,
  isUploading: false,
  isParsing: false,
  detectedType: "hospital",
  channelType: "callbot",
  setUploadedFiles: (files) => set({ uploadedFiles: files }),
  setParsedFiles: (files) => set({ parsedFiles: files }),
  setUploadResult: (result) => set({ uploadResult: result }),
  setIsUploading: (v) => set({ isUploading: v }),
  setIsParsing: (v) => set({ isParsing: v }),
  setDetectedType: (type) => set({ detectedType: type }),
  setChannelType: (type) => set({ channelType: type }),

  parsedTextContent: "",
  parsedImageDescriptions: [],
  usedImageDescriptions: [],
  showParsedReview: false,
  setParsedTextContent: (text) => set({ parsedTextContent: text }),
  setParsedImageDescriptions: (descs) => set({ parsedImageDescriptions: descs }),
  setUsedImageDescriptions: (descs) => set({ usedImageDescriptions: descs }),
  setShowParsedReview: (v) => set({ showParsedReview: v }),

  generatedPrompt: null,
  editedFullText: "",
  previousPromptText: "",
  isGenerating: false,
  setGeneratedPrompt: (prompt) =>
    set({ generatedPrompt: prompt, editedFullText: prompt?.fullText ?? "", previousPromptText: "" }),
  setEditedFullText: (text) => set({ editedFullText: text }),
  setEditedFullTextWithDiff: (text) =>
    set((state) => ({ previousPromptText: state.editedFullText, editedFullText: text })),
  clearPreviousPromptText: () => set({ previousPromptText: "" }),
  setIsGenerating: (v) => set({ isGenerating: v }),

  improveHistory: [],
  addImproveRecord: (record) =>
    set((state) => ({ improveHistory: [...state.improveHistory, record] })),

  chatMessages: [],
  chatSettings: { temperature: 0.25, maxTokens: 1024 },
  dummyData: initialDummyData,
  greetingMessage: "",
  isChatLoading: false,
  setGreetingMessage: (msg) => set({ greetingMessage: msg }),
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
  setChatSettings: (settings) =>
    set((state) => ({
      chatSettings: { ...state.chatSettings, ...settings },
    })),
  setDummyData: (data) =>
    set((state) => ({ dummyData: { ...state.dummyData, ...data } })),
  setIsChatLoading: (v) => set({ isChatLoading: v }),
  initChat: () =>
    set((state) => {
      const greeting = state.greetingMessage;
      if (greeting) {
        return {
          chatMessages: [
            {
              id: "greeting",
              role: "assistant" as const,
              content: greeting,
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }
      return { chatMessages: [] };
    }),
  clearChat: () =>
    set((state) => {
      const greeting = state.greetingMessage;
      if (greeting) {
        return {
          chatMessages: [
            {
              id: "greeting",
              role: "assistant" as const,
              content: greeting,
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }
      return { chatMessages: [] };
    }),

  resetAll: () =>
    set({
      currentStep: "upload",
      uploadedFiles: [],
      parsedFiles: [],
      uploadResult: null,
      isUploading: false,
      isParsing: false,
      detectedType: "hospital",
      channelType: "callbot",
      generatedPrompt: null,
      editedFullText: "",
      previousPromptText: "",
      isGenerating: false,
      chatMessages: [],
      isChatLoading: false,
    }),
}));
