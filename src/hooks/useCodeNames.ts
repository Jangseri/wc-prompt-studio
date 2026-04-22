'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithRetry } from '@/lib/fetch-utils'

export function useCodeNames() {
  const [codeNames, setCodeNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchCodeNames = async () => {
      try {
        const res = await fetchWithRetry('/api/codes/map')
        const data = await res.json()
        if (data.success) {
          const cleaned: Record<string, string> = {}
          for (const [code, name] of Object.entries(data.data as Record<string, string>)) {
            cleaned[code] = name.replace(/^서비스_/, '').replace(/^프롬프트_/, '')
          }
          setCodeNames(cleaned)
        }
      } catch {
        console.error('[useCodeNames] 코드명 로딩 실패')
      }
    }
    fetchCodeNames()
  }, [])

  const getCodeName = useCallback((code: string) => codeNames[code] || code, [codeNames])

  return { codeNames, getCodeName }
}
