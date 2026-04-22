'use client'

import { useState, useEffect } from 'react'
import { fetchWithRetry } from '@/lib/fetch-utils'

export interface CodeOption {
  code: string
  label: string
  depth: number
}

export interface CodeGroup {
  groupLabel: string
  options: CodeOption[]
}

interface RawCode {
  code: string
  up_code: string
  name_ko: string
}

function collectDescendants(codes: RawCode[], parentCode: string, depth: number): CodeOption[] {
  const children = codes.filter((c) => c.up_code === parentCode)
  const result: CodeOption[] = []
  for (const child of children) {
    result.push({
      code: child.code,
      label: `${child.code} (${child.name_ko})`,
      depth,
    })
    result.push(...collectDescendants(codes, child.code, depth + 1))
  }
  return result
}

function buildGroups(codes: RawCode[], rootCode: string): CodeGroup[] {
  // Groups: codes whose up_code === rootCode (e.g. SA0000, SB0000)
  // Each group includes itself (depth 0) + all descendants with increasing depth
  const groups = codes.filter((c) => c.up_code === rootCode && c.code !== rootCode)
  const result: CodeGroup[] = []

  for (const group of groups) {
    const options: CodeOption[] = [
      { code: group.code, label: `${group.code} (${group.name_ko})`, depth: 0 },
      ...collectDescendants(codes, group.code, 1),
    ]
    result.push({
      groupLabel: `${group.code.substring(0, 2)} · ${group.name_ko}`,
      options,
    })
  }

  return result
}

export function useCodeOptions() {
  const [svcGroups, setSvcGroups] = useState<CodeGroup[]>([])
  const [prmtGroups, setPrmtGroups] = useState<CodeGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [svcRes, prmtRes] = await Promise.all([
          fetchWithRetry('/api/codes/tree?prefix=S'),
          fetchWithRetry('/api/codes/tree?prefix=P'),
        ])
        const [svcData, prmtData] = await Promise.all([svcRes.json(), prmtRes.json()])

        if (svcData.success) {
          setSvcGroups(buildGroups(svcData.data, 'S00000'))
        }
        if (prmtData.success) {
          setPrmtGroups(buildGroups(prmtData.data, 'P00000'))
        }
      } catch {
        console.error('[useCodeOptions] 코드 옵션 로딩 실패')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  return { svcGroups, prmtGroups, loading }
}
