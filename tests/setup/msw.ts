import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

export const openAiChatHandler = http.post(
  'https://api.openai.com/v1/chat/completions',
  async () => {
    return HttpResponse.json({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'mock response' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })
  }
)

export const openAiResponsesHandler = http.post(
  'https://api.openai.com/v1/responses',
  async () => {
    return HttpResponse.json({
      id: 'resp-test',
      object: 'response',
      status: 'completed',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '{}' }],
        },
      ],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    })
  }
)

export const defaultOpenAiHandlers = [openAiChatHandler, openAiResponsesHandler]

export function createMswServer(handlers = defaultOpenAiHandlers) {
  return setupServer(...handlers)
}
