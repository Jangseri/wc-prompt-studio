export interface LlmModel {
  name: string
  engCPT: number  // English chars-per-token
  korTPT: number  // Korean tokens-per-char
}

export const llmModels: Record<string, LlmModel> = {
  'LA1000': { name: 'GPT-4o',           engCPT: 3.8, korTPT: 1.6 },
  'LA2000': { name: 'GPT-4o mini',      engCPT: 3.8, korTPT: 1.6 },
  'LA3000': { name: 'GPT-5',            engCPT: 3.5, korTPT: 1.5 },
  'LA3001': { name: 'GPT-5 mini',       engCPT: 3.5, korTPT: 1.5 },
  'LA3002': { name: 'GPT-5.2',          engCPT: 3.5, korTPT: 1.5 },
  'LB1000': { name: 'Gemini 2.5 Flash', engCPT: 4.0, korTPT: 1.3 },
}

export function getModelName(modelCode: string | null): string {
  if (!modelCode) return '-'
  return llmModels[modelCode]?.name || modelCode
}

export function estimateTokens(text: string, modelCode: string): number {
  const m = llmModels[modelCode] || llmModels['LA1000']
  let tokens = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp >= 0xAC00 && cp <= 0xD7A3) {
      tokens += m.korTPT
    } else if (cp < 0x80) {
      tokens += 1 / m.engCPT
    } else {
      tokens += 1.0
    }
  }
  return Math.ceil(tokens)
}
