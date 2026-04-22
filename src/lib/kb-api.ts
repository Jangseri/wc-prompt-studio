import type { KBItem } from '@/types/editor'
import { fetchWithTimeout } from './fetch-utils'

export async function fetchKBList(companySeq: string): Promise<KBItem[]> {
  if (!companySeq) return []

  const res = await fetchWithTimeout(`/api/kb?company_seq=${encodeURIComponent(companySeq)}`)

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '응답 파싱 실패' }))
    throw new Error(data.error || `KB 목록 조회 실패 (${res.status})`)
  }

  const data = await res.json()

  if (!data.success) {
    throw new Error(data.error || 'KB 목록 조회 실패')
  }

  return (data.data as string[]).map((fileName) => ({
    file_name: fileName,
    company_seq: companySeq,
  }))
}

export async function fetchKBContent(companySeq: string, fileName: string): Promise<string> {
  const res = await fetchWithTimeout('/api/kb-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_seq: companySeq, file_name: fileName }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '응답 파싱 실패' }))
    throw new Error(data.error || `KB 파일 조회 실패 (${res.status})`)
  }

  const data = await res.json()

  if (!data.success) {
    throw new Error(data.error || 'KB 파일 조회 실패')
  }

  return data.data as string
}
