'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { fetchKBContent } from '@/lib/kb-api'
import type { KBItem } from '@/types/editor'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface KBViewerProps {
  item: KBItem | null
}

export function KBViewer({ item }: KBViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!item) {
      setContent(null)
      setError(null)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setContent(null)
      setError(null)
      try {
        const result = await fetchKBContent(item.company_seq, item.file_name)
        if (!cancelled) {
          setContent(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '파일 내용을 불러올 수 없습니다')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [item])

  if (!item) {
    return (
      <main className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-secondary flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <p className="text-[14px] font-medium mb-1">Knowledge Base</p>
          <p className="text-[12px]">좌측 목록에서 항목을 선택하세요</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col min-h-0 bg-muted/30">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/40 bg-card/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">{item.file_name}</h2>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/30">
              {item.company_seq}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground text-[13px]">
              <div className="inline-block w-5 h-5 border-[1.5px] border-border border-t-indigo-500 rounded-full animate-spin mb-2" />
              <div>내용 로딩 중...</div>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center p-6 max-w-sm">
              <div className="w-12 h-12 mx-auto mb-3 bg-red-500/10 dark:bg-red-950/30 rounded-2xl flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-600 dark:text-red-400">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">파일을 불러올 수 없습니다</p>
              <p className="text-[12px] text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : (
          <div className="h-full rounded-xl overflow-hidden border border-border/60 shadow-sm">
            <MonacoEditor
              height="100%"
              defaultLanguage="plaintext"
              value={content ?? ''}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineHeight: 22,
                padding: { top: 16 },
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                renderLineHighlight: 'none',
                domReadOnly: true,
              }}
            />
          </div>
        )}
      </div>
    </main>
  )
}
