export interface PromptSections {
  introduction: string;
  responseRules: string;
  businessStatus: string;
  conversationFlow: string;
  callEnd: string;
  exceptionHandling: string;
  referenceData: string;
}

export interface GeneratedPrompt {
  id: string;
  fullText: string;
  sections: PromptSections;
  type: "hospital" | "general";
  createdAt: string;
  sourceFileName: string;
}
