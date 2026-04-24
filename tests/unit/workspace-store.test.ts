import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace-store";

beforeEach(() => {
  useWorkspaceStore.getState().reset();
});

describe("useWorkspaceStore initial state", () => {
  it("starts in idle mode with empty fields", () => {
    const s = useWorkspaceStore.getState();
    expect(s.mode).toBe("idle");
    expect(s.selectedCompanySeq).toBeNull();
    expect(s.selectedAiStaffSeq).toBeNull();
    expect(s.currentStep).toBe("setup");
    expect(s.companySeq).toBe("");
    expect(s.aiStaffSeq).toBe("");
    expect(s.sourceFiles).toEqual([]);
    expect(s.channel).toBeNull();
    expect(s.draftGenerated).toBe(false);
    expect(s.applyStatus).toBe("idle");
  });
});

describe("mode transitions", () => {
  it("startNewWorkflow switches to workflow mode and resets workflow fields", () => {
    const s = useWorkspaceStore.getState();
    // Pollute some state first
    s.setCompanySeq("foo");
    s.setChannel("chatbot");
    s.setDraftGenerated(true);
    // Trigger
    useWorkspaceStore.getState().startNewWorkflow();
    const after = useWorkspaceStore.getState();
    expect(after.mode).toBe("workflow");
    expect(after.companySeq).toBe("");
    expect(after.channel).toBeNull();
    expect(after.draftGenerated).toBe(false);
    expect(after.currentStep).toBe("setup");
  });

  it("selectCompanyForManagement switches to manage mode and mirrors ids", () => {
    useWorkspaceStore.getState().selectCompanyForManagement("5130", "12682");
    const after = useWorkspaceStore.getState();
    expect(after.mode).toBe("manage");
    expect(after.selectedCompanySeq).toBe("5130");
    expect(after.selectedAiStaffSeq).toBe("12682");
    // Also mirrors into the setup fields so KB tab can use companySeq
    expect(after.companySeq).toBe("5130");
    expect(after.aiStaffSeq).toBe("12682");
  });

  it("goIdle clears the selection and returns to idle", () => {
    useWorkspaceStore.getState().selectCompanyForManagement("A", "1");
    useWorkspaceStore.getState().goIdle();
    const after = useWorkspaceStore.getState();
    expect(after.mode).toBe("idle");
    expect(after.selectedCompanySeq).toBeNull();
    expect(after.selectedAiStaffSeq).toBeNull();
  });
});

describe("canAdvanceFrom", () => {
  it("setup requires both identifiers", () => {
    const { canAdvanceFrom, setCompanySeq, setAiStaffSeq } = useWorkspaceStore.getState();
    expect(canAdvanceFrom("setup")).toBe(false);
    setCompanySeq("A");
    expect(useWorkspaceStore.getState().canAdvanceFrom("setup")).toBe(false);
    setAiStaffSeq("1");
    expect(useWorkspaceStore.getState().canAdvanceFrom("setup")).toBe(true);
  });

  it("source requires files + channel + industry", () => {
    const { setSourceFiles, setChannel, setIndustry } = useWorkspaceStore.getState();
    expect(useWorkspaceStore.getState().canAdvanceFrom("source")).toBe(false);
    setSourceFiles([new File(["a"], "a.xlsx")]);
    expect(useWorkspaceStore.getState().canAdvanceFrom("source")).toBe(false);
    setChannel("callbot");
    expect(useWorkspaceStore.getState().canAdvanceFrom("source")).toBe(false);
    setIndustry("병원");
    expect(useWorkspaceStore.getState().canAdvanceFrom("source")).toBe(true);
  });

  it("analysis requires parsedText + draftGenerated", () => {
    const { setParsedText, setDraftGenerated } = useWorkspaceStore.getState();
    expect(useWorkspaceStore.getState().canAdvanceFrom("analysis")).toBe(false);
    setParsedText("some text");
    expect(useWorkspaceStore.getState().canAdvanceFrom("analysis")).toBe(false);
    setDraftGenerated(true);
    expect(useWorkspaceStore.getState().canAdvanceFrom("analysis")).toBe(true);
  });

  it("regions requires draftGenerated", () => {
    expect(useWorkspaceStore.getState().canAdvanceFrom("regions")).toBe(false);
    useWorkspaceStore.getState().setDraftGenerated(true);
    expect(useWorkspaceStore.getState().canAdvanceFrom("regions")).toBe(true);
  });

  it("apply advances only when applyStatus === 'success'", () => {
    expect(useWorkspaceStore.getState().canAdvanceFrom("apply")).toBe(false);
    useWorkspaceStore.getState().setApplyStatus("success");
    expect(useWorkspaceStore.getState().canAdvanceFrom("apply")).toBe(true);
  });
});

describe("goNext / goPrev", () => {
  it("moves through the step sequence", () => {
    useWorkspaceStore.getState().goNext();
    expect(useWorkspaceStore.getState().currentStep).toBe("source");
    useWorkspaceStore.getState().goNext();
    expect(useWorkspaceStore.getState().currentStep).toBe("analysis");
    useWorkspaceStore.getState().goPrev();
    expect(useWorkspaceStore.getState().currentStep).toBe("source");
  });

  it("does not advance past the last step", () => {
    useWorkspaceStore.getState().setStep("apply");
    useWorkspaceStore.getState().goNext();
    expect(useWorkspaceStore.getState().currentStep).toBe("apply");
  });

  it("does not go below the first step", () => {
    useWorkspaceStore.getState().goPrev();
    expect(useWorkspaceStore.getState().currentStep).toBe("setup");
  });
});

describe("analysis exclusion state", () => {
  it("starts with nothing excluded", () => {
    const s = useWorkspaceStore.getState();
    expect(s.textExcluded).toBe(false);
    expect(s.excludedImageIndices).toEqual([]);
  });

  it("toggleExcludedImage adds then removes the index", () => {
    const { toggleExcludedImage } = useWorkspaceStore.getState();
    toggleExcludedImage(1);
    expect(useWorkspaceStore.getState().excludedImageIndices).toEqual([1]);
    toggleExcludedImage(0);
    expect(useWorkspaceStore.getState().excludedImageIndices).toEqual([1, 0]);
    toggleExcludedImage(1);
    expect(useWorkspaceStore.getState().excludedImageIndices).toEqual([0]);
  });

  it("setImageDescriptions clears stale exclusions from a prior parse", () => {
    const s = useWorkspaceStore.getState();
    s.setImageDescriptions(["a", "b", "c"]);
    s.toggleExcludedImage(0);
    s.toggleExcludedImage(2);
    expect(useWorkspaceStore.getState().excludedImageIndices).toEqual([0, 2]);
    // A fresh parse: old indices may not even be valid for the new list.
    s.setImageDescriptions(["x"]);
    expect(useWorkspaceStore.getState().excludedImageIndices).toEqual([]);
  });

  it("setImageDescriptionAt edits a single entry without touching exclusions", () => {
    const s = useWorkspaceStore.getState();
    s.setImageDescriptions(["a", "b"]);
    s.toggleExcludedImage(0);
    s.setImageDescriptionAt(1, "b-edited");
    const after = useWorkspaceStore.getState();
    expect(after.imageDescriptions).toEqual(["a", "b-edited"]);
    expect(after.excludedImageIndices).toEqual([0]);
  });

  it("setImageDescriptionAt is a no-op when the index is out of range", () => {
    const s = useWorkspaceStore.getState();
    s.setImageDescriptions(["a"]);
    s.setImageDescriptionAt(5, "boom");
    expect(useWorkspaceStore.getState().imageDescriptions).toEqual(["a"]);
  });

  it("setTextExcluded does not mutate parsedText", () => {
    const s = useWorkspaceStore.getState();
    s.setParsedText("hello");
    s.setTextExcluded(true);
    expect(useWorkspaceStore.getState().parsedText).toBe("hello");
    expect(useWorkspaceStore.getState().textExcluded).toBe(true);
    s.setTextExcluded(false);
    expect(useWorkspaceStore.getState().parsedText).toBe("hello");
  });
});

describe("reset", () => {
  it("restores initial state after mutations", () => {
    const s = useWorkspaceStore.getState();
    s.setCompanySeq("X");
    s.setAiStaffSeq("Y");
    s.setChannel("chatbot");
    s.setIndustry("금융");
    s.setParsedText("some");
    s.setTextExcluded(true);
    s.setImageDescriptions(["one", "two"]);
    s.toggleExcludedImage(1);
    s.setDraftGenerated(true);
    s.setApplyStatus("success");
    s.setStep("apply");
    s.selectCompanyForManagement("Z", "Q");

    s.reset();

    const after = useWorkspaceStore.getState();
    expect(after.mode).toBe("idle");
    expect(after.selectedCompanySeq).toBeNull();
    expect(after.selectedAiStaffSeq).toBeNull();
    expect(after.companySeq).toBe("");
    expect(after.aiStaffSeq).toBe("");
    expect(after.channel).toBeNull();
    expect(after.industry).toBe("");
    expect(after.parsedText).toBe("");
    expect(after.textExcluded).toBe(false);
    expect(after.imageDescriptions).toEqual([]);
    expect(after.excludedImageIndices).toEqual([]);
    expect(after.draftGenerated).toBe(false);
    expect(after.applyStatus).toBe("idle");
    expect(after.currentStep).toBe("setup");
  });
});
