import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace-store";

beforeEach(() => {
  useWorkspaceStore.getState().reset();
});

describe("useWorkspaceStore initial state", () => {
  it("starts at the setup step with empty fields", () => {
    const s = useWorkspaceStore.getState();
    expect(s.currentStep).toBe("setup");
    expect(s.companySeq).toBe("");
    expect(s.aiStaffSeq).toBe("");
    expect(s.sourceFiles).toEqual([]);
    expect(s.channel).toBeNull();
    expect(s.draftGenerated).toBe(false);
    expect(s.applyStatus).toBe("idle");
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

describe("reset", () => {
  it("restores initial state after mutations", () => {
    const s = useWorkspaceStore.getState();
    s.setCompanySeq("X");
    s.setAiStaffSeq("Y");
    s.setChannel("chatbot");
    s.setIndustry("금융");
    s.setParsedText("some");
    s.setDraftGenerated(true);
    s.setApplyStatus("success");
    s.setStep("apply");

    s.reset();

    const after = useWorkspaceStore.getState();
    expect(after.companySeq).toBe("");
    expect(after.aiStaffSeq).toBe("");
    expect(after.channel).toBeNull();
    expect(after.industry).toBe("");
    expect(after.parsedText).toBe("");
    expect(after.draftGenerated).toBe(false);
    expect(after.applyStatus).toBe("idle");
    expect(after.currentStep).toBe("setup");
  });
});
