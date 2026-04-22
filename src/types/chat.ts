export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface ChatSettings {
  temperature: number;
  maxTokens: number;
}

export interface DummyData {
  aa2001: string;
  aa2002: string;
  aa2003: string;
  aa1000: string;
}
