import { create } from "zustand";
import type { Channel } from "@/lib/prompt-codes";

export type StepId =
  | "setup"
  | "source"
  | "analysis"
  | "regions"
  | "apply";

export const STEP_ORDER: readonly StepId[] = [
  "setup",
  "source",
  "analysis",
  "regions",
  "apply",
] as const;

export interface ApplyRecord {
  cstm_id: number;
  svc_cd: string;
  prmt_cd: string;
}

export interface ApplyResult {
  main: ApplyRecord;
  siblings: Array<{ prmt_cd: string; cstm_id: number | null; created: boolean }>;
}

interface WorkspaceState {
  /* ── Setup ── */
  companySeq: string;
  aiStaffSeq: string;

  /* ── Source ── */
  sourceFiles: File[];
  channel: Channel | null;
  industry: string;

  /* ── Analysis / parse ── */
  isParsing: boolean;
  parsedText: string;
  imageDescriptions: string[];
  parseError: string | null;

  /* ── Draft generation ── */
  isGenerating: boolean;
  draftGenerated: boolean;
  generateError: string | null;

  /* ── Apply ── */
  isApplying: boolean;
  applyStatus: "idle" | "success" | "error";
  applyResult: ApplyResult | null;
  applyError: string | null;

  /* ── Navigation ── */
  currentStep: StepId;
}

interface WorkspaceActions {
  setCompanySeq: (v: string) => void;
  setAiStaffSeq: (v: string) => void;

  setSourceFiles: (files: File[]) => void;
  setChannel: (c: Channel | null) => void;
  setIndustry: (v: string) => void;

  setParsing: (v: boolean) => void;
  setParsedText: (v: string) => void;
  setImageDescriptions: (v: string[]) => void;
  setParseError: (v: string | null) => void;

  setGenerating: (v: boolean) => void;
  setDraftGenerated: (v: boolean) => void;
  setGenerateError: (v: string | null) => void;

  setApplying: (v: boolean) => void;
  setApplyStatus: (s: "idle" | "success" | "error") => void;
  setApplyResult: (r: ApplyResult | null) => void;
  setApplyError: (v: string | null) => void;

  setStep: (s: StepId) => void;
  goNext: () => void;
  goPrev: () => void;
  canAdvanceFrom: (s: StepId) => boolean;

  reset: () => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

const INITIAL_STATE: WorkspaceState = {
  companySeq: "",
  aiStaffSeq: "",

  sourceFiles: [],
  channel: null,
  industry: "",

  isParsing: false,
  parsedText: "",
  imageDescriptions: [],
  parseError: null,

  isGenerating: false,
  draftGenerated: false,
  generateError: null,

  isApplying: false,
  applyStatus: "idle",
  applyResult: null,
  applyError: null,

  currentStep: "setup",
};

function canAdvanceFromStep(state: WorkspaceState, step: StepId): boolean {
  switch (step) {
    case "setup":
      return state.companySeq.trim().length > 0 && state.aiStaffSeq.trim().length > 0;
    case "source":
      return (
        state.sourceFiles.length > 0 &&
        state.channel !== null &&
        state.industry.trim().length > 0
      );
    case "analysis":
      return state.parsedText.trim().length > 0 && state.draftGenerated;
    case "regions":
      return state.draftGenerated;
    case "apply":
      return state.applyStatus === "success";
  }
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  ...INITIAL_STATE,

  setCompanySeq: (v) => set({ companySeq: v }),
  setAiStaffSeq: (v) => set({ aiStaffSeq: v }),

  setSourceFiles: (sourceFiles) => set({ sourceFiles }),
  setChannel: (channel) => set({ channel }),
  setIndustry: (industry) => set({ industry }),

  setParsing: (isParsing) => set({ isParsing }),
  setParsedText: (parsedText) => set({ parsedText }),
  setImageDescriptions: (imageDescriptions) => set({ imageDescriptions }),
  setParseError: (parseError) => set({ parseError }),

  setGenerating: (isGenerating) => set({ isGenerating }),
  setDraftGenerated: (draftGenerated) => set({ draftGenerated }),
  setGenerateError: (generateError) => set({ generateError }),

  setApplying: (isApplying) => set({ isApplying }),
  setApplyStatus: (applyStatus) => set({ applyStatus }),
  setApplyResult: (applyResult) => set({ applyResult }),
  setApplyError: (applyError) => set({ applyError }),

  setStep: (currentStep) => set({ currentStep }),

  goNext: () => {
    const { currentStep } = get();
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) {
      set({ currentStep: STEP_ORDER[idx + 1] });
    }
  },

  goPrev: () => {
    const { currentStep } = get();
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      set({ currentStep: STEP_ORDER[idx - 1] });
    }
  },

  canAdvanceFrom: (step) => canAdvanceFromStep(get(), step),

  reset: () => set({ ...INITIAL_STATE }),
}));
