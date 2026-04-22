'use client'

import { useState, useEffect } from 'react'
import { fetchWithRetry } from '@/lib/fetch-utils'

export function useLlmConfig() {
  const [llmConfigMap, setLlmConfigMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetchWithRetry('/api/llm-config')
        const data = await res.json()
        if (data.success) {
          setLlmConfigMap(data.data)
        }
      } catch {
        console.error('[useLlmConfig] LLM 설정 로딩 실패')
      }
    }
    fetchConfig()
  }, [])

  return { llmConfigMap }
}
