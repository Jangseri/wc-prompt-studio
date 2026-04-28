import { create } from "zustand";
import { resolveChannelCode, type Channel } from "@/lib/prompt-codes";
import { useStructuringStore } from "./structuring-store";

/**
 * Center-panel mode.
 * - idle: welcome screen (default). User picks a company from the
 *   sidebar or starts a new workflow.
 * - workflow: 5-step wizard for creating a new prompt set.
 * - manage: edit the existing prompts of a selected (company, staff)
 *   pair.
 */
export type WorkspaceMode = "idle" | "workflow" | "manage";

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
  /* ── Mode + management selection ── */
  mode: WorkspaceMode;
  selectedCompanySeq: string | null;
  selectedAiStaffSeq: string | null;

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
  textExcluded: boolean;
  imageDescriptions: string[];
  excludedImageIndices: number[];
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

  /* ── Pre-check: existing prompts for current (company, staff) pair ── */
  /** svc_cd → count. `null` means not fetched yet (Setup hasn't run the
   *  check or fields are empty). Read by SourceStep to block advance
   *  when the resolved svc_cd already has rows. */
  existingPromptsByService: Record<string, number> | null;

  /* ── Navigation ── */
  currentStep: StepId;
  /**
   * Highest step index the user has reached during this workflow.
   * Used to keep already-visited steps clickable in the workflow nav
   * even after the user navigates back to an earlier step. Resets to
   * 0 on a fresh workflow.
   */
  maxVisitedStepIndex: number;
}

interface WorkspaceActions {
  setCompanySeq: (v: string) => void;
  setAiStaffSeq: (v: string) => void;

  setSourceFiles: (files: File[]) => void;
  setChannel: (c: Channel | null) => void;
  setIndustry: (v: string) => void;

  setParsing: (v: boolean) => void;
  setParsedText: (v: string) => void;
  setTextExcluded: (v: boolean) => void;
  setImageDescriptions: (v: string[]) => void;
  setImageDescriptionAt: (index: number, value: string) => void;
  toggleExcludedImage: (index: number) => void;
  setParseError: (v: string | null) => void;

  setGenerating: (v: boolean) => void;
  setDraftGenerated: (v: boolean) => void;
  setGenerateError: (v: string | null) => void;

  setApplying: (v: boolean) => void;
  setApplyStatus: (s: "idle" | "success" | "error") => void;
  setApplyResult: (r: ApplyResult | null) => void;
  setApplyError: (v: string | null) => void;

  setExistingPromptsByService: (v: Record<string, number> | null) => void;

  setStep: (s: StepId) => void;
  goNext: () => void;
  goPrev: () => void;
  canAdvanceFrom: (s: StepId) => boolean;

  /* ── Mode transitions ── */
  goIdle: () => void;
  startNewWorkflow: () => void;
  selectCompanyForManagement: (companySeq: string, aiStaffSeq: string) => void;

  reset: () => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

const INITIAL_STATE: WorkspaceState = {
  mode: "idle",
  selectedCompanySeq: null,
  selectedAiStaffSeq: null,

  companySeq: "",
  aiStaffSeq: "",

  sourceFiles: [],
  channel: null,
  industry: "",

  isParsing: false,
  parsedText: "",
  textExcluded: false,
  imageDescriptions: [],
  excludedImageIndices: [],
  parseError: null,

  isGenerating: false,
  draftGenerated: false,
  generateError: null,

  isApplying: false,
  applyStatus: "idle",
  applyResult: null,
  applyError: null,

  existingPromptsByService: null,

  currentStep: "setup",
  maxVisitedStepIndex: 0,
};

function canAdvanceFromStep(state: WorkspaceState, step: StepId): boolean {
  switch (step) {
    case "setup":
      return state.companySeq.trim().length > 0 && state.aiStaffSeq.trim().length > 0;
    case "source": {
      const baseOk =
        state.sourceFiles.length > 0 &&
        state.channel !== null &&
        state.industry.trim().length > 0;
      if (!baseOk) return false;
      // Block advance when the (channel, industry) resolved svc_cd
      // already has existing rows for this (company, staff) — they'd
      // be rejected at Apply anyway.
      if (state.existingPromptsByService) {
        const svcCd = resolveChannelCode(
          state.channel!,
          state.industry
        ).svc_cd;
        const count = state.existingPromptsByService[svcCd] ?? 0;
        if (count > 0) return false;
      }
      return true;
    }
    case "analysis":
      // Image-only uploads leave parsedText empty but still produce
      // imageDescriptions — either signal counts as "analyzed".
      return (
        (state.parsedText.trim().length > 0 ||
          state.imageDescriptions.length > 0) &&
        state.draftGenerated
      );
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

  setSourceFiles: (sourceFiles) => {
    // Changing the file set invalidates everything downstream of the
    // parse: text, image descriptions, the generated draft, and the
    // Regions structuring data. Reset all of it so the user is forced
    // back through Analysis with the new files. Without this, Analysis
    // would silently show stale results from the previous file set.
    set({
      sourceFiles,
      parsedText: "",
      textExcluded: false,
      imageDescriptions: [],
      excludedImageIndices: [],
      parseError: null,
      draftGenerated: false,
      generateError: null,
    });
    // Cross-store: clear the Regions draft + any chat history that was
    // tied to the previous file set's analysis.
    useStructuringStore.getState().reset();
  },
  setChannel: (channel) => set({ channel }),
  setIndustry: (industry) => set({ industry }),

  setParsing: (isParsing) => set({ isParsing }),
  setParsedText: (parsedText) => set({ parsedText }),
  setTextExcluded: (textExcluded) => set({ textExcluded }),
  // Replacing the whole array = new parse result; clear per-image
  // exclusions so stale indices don't leak into the fresh set.
  setImageDescriptions: (imageDescriptions) =>
    set({ imageDescriptions, excludedImageIndices: [] }),
  setImageDescriptionAt: (index, value) =>
    set((state) => {
      if (index < 0 || index >= state.imageDescriptions.length) return state;
      const next = state.imageDescriptions.slice();
      next[index] = value;
      return { imageDescriptions: next };
    }),
  toggleExcludedImage: (index) =>
    set((state) => {
      const has = state.excludedImageIndices.includes(index);
      return {
        excludedImageIndices: has
          ? state.excludedImageIndices.filter((i) => i !== index)
          : [...state.excludedImageIndices, index],
      };
    }),
  setParseError: (parseError) => set({ parseError }),

  setGenerating: (isGenerating) => set({ isGenerating }),
  setDraftGenerated: (draftGenerated) => set({ draftGenerated }),
  setGenerateError: (generateError) => set({ generateError }),

  setApplying: (isApplying) => set({ isApplying }),
  setApplyStatus: (applyStatus) => set({ applyStatus }),
  setApplyResult: (applyResult) => set({ applyResult }),
  setApplyError: (applyError) => set({ applyError }),

  setExistingPromptsByService: (existingPromptsByService) =>
    set({ existingPromptsByService }),

  setStep: (currentStep) =>
    set((state) => ({
      currentStep,
      maxVisitedStepIndex: Math.max(
        state.maxVisitedStepIndex,
        STEP_ORDER.indexOf(currentStep)
      ),
    })),

  goNext: () => {
    const { currentStep } = get();
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) {
      const nextIdx = idx + 1;
      set((state) => ({
        currentStep: STEP_ORDER[nextIdx],
        maxVisitedStepIndex: Math.max(state.maxVisitedStepIndex, nextIdx),
      }));
    }
  },

  goPrev: () => {
    const { currentStep } = get();
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      // No need to update maxVisitedStepIndex when stepping back —
      // the previous step's index is by definition <= the current
      // max, and Math.max() would be a no-op anyway.
      set({ currentStep: STEP_ORDER[idx - 1] });
    }
  },

  canAdvanceFrom: (step) => canAdvanceFromStep(get(), step),

  goIdle: () =>
    set({
      mode: "idle",
      selectedCompanySeq: null,
      selectedAiStaffSeq: null,
    }),

  startNewWorkflow: () =>
    set({
      ...INITIAL_STATE,
      mode: "workflow",
    }),

  selectCompanyForManagement: (companySeq, aiStaffSeq) =>
    set({
      mode: "manage",
      selectedCompanySeq: companySeq,
      selectedAiStaffSeq: aiStaffSeq,
      // Also mirror into the setup fields so the KB panel (which uses
      // companySeq) can find the right company.
      companySeq,
      aiStaffSeq,
    }),

  reset: () => set({ ...INITIAL_STATE }),
}));
