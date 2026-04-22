export type TargetLLM = "gpt" | "claude" | "gemini";

export type RegionId =
  | "role"
  | "persona"
  | "companyInfo"
  | "answerScope"
  | "branching"
  | "toolCalling"
  | "system"
  | "conversation";

export interface RoleRegion {
  content: string;
}

export interface PersonaRegion {
  language: string;
  tone: string;
}

export interface CompanyInfoRegion {
  description: string;
  greeting: string;
}

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
}

export type AnswerSpecificsType = "keyValue" | "sentence";

export interface AnswerScopeRegion {
  rag: {
    enabled: boolean;
    performanceNotes: string;
  };
  specifics: {
    type: AnswerSpecificsType;
    keyValueItems: KeyValueItem[];
    sentence: string;
  };
}

export interface BranchingRegion {
  description: string;
  pseudoCode: string;
}

export interface ToolCallingRegion {
  mcp: string;
  api: string;
  agent: string;
  dataQuery: string;
}

export interface SystemRegion {
  sttTts: string;
}

export interface ConversationRegion {
  rules: {
    rejectOutOfScope: boolean;
    noReAskCollected: boolean;
    oneQuestionAtATime: boolean;
    noInference: boolean;
    restrictedInfoOnly: boolean;
  };
  customNotes: string;
}

export interface StructuringPrompt {
  role: RoleRegion;
  persona: PersonaRegion;
  companyInfo: CompanyInfoRegion;
  answerScope: AnswerScopeRegion;
  branching: BranchingRegion;
  toolCalling: ToolCallingRegion;
  system: SystemRegion;
  conversation: ConversationRegion;
}

export interface RegionMeta {
  id: RegionId;
  label: string;
  description: string;
}

export const REGION_ORDER: RegionId[] = [
  "role",
  "persona",
  "companyInfo",
  "answerScope",
  "branching",
  "toolCalling",
  "system",
  "conversation",
];

export const REGION_META: Record<RegionId, RegionMeta> = {
  role: {
    id: "role",
    label: "Role",
    description: "AI의 역할 정의",
  },
  persona: {
    id: "persona",
    label: "Persona",
    description: "언어 · 어투",
  },
  companyInfo: {
    id: "companyInfo",
    label: "업무 및 회사 정보",
    description: "업무 소개 · 인사말",
  },
  answerScope: {
    id: "answerScope",
    label: "대답의 범위 / 내용",
    description: "RAG · 특정 내용 지정",
  },
  branching: {
    id: "branching",
    label: "분기에 대한 설명",
    description: "업무 유형/시간 · pseudo code",
  },
  toolCalling: {
    id: "toolCalling",
    label: "Tool 호출 규칙",
    description: "MCP · API · Agent · Data Query",
  },
  system: {
    id: "system",
    label: "System",
    description: "STT / TTS",
  },
  conversation: {
    id: "conversation",
    label: "대화유지",
    description: "응대 규칙",
  },
};

export const TARGET_LLM_META: Record<TargetLLM, { label: string; formatName: string }> = {
  gpt: { label: "GPT", formatName: "Markdown" },
  claude: { label: "Claude", formatName: "XML Tags" },
  gemini: { label: "Gemini", formatName: "Markdown + 구분자" },
};
