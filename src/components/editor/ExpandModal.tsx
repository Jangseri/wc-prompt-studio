'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { estimateTokens, getModelName } from '@/lib/tokenEstimator'
import { EditorErrorBoundary } from './EditorErrorBoundary'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface ExpandModalProps {
  open: boolean
  target: 'prompt' | 'json' | null
  value: string
  modelCode: string | null
  onApply: (value: string) => void
  onClose: () => void
}

export function ExpandModal({ open, target, value, modelCode, onApply, onClose }: ExpandModalProps) {
  const [text, setText] = useState(value)
  const { resolvedTheme } = useTheme()
  const monacoTheme = resolvedTheme === 'light' ? 'vs' : 'vs-dark'

  useEffect(() => {
    if (open) setText(value)
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const handleApply = useCallback(() => {
    onApply(text)
  }, [text, onApply])

  if (!open || !target) return null

  const isPrompt = target === 'prompt'
  const title = isPrompt ? 'Prompt (프롬프트 텍스트)' : 'JSON Schema'
  const badge = isPrompt ? 'plaintext' : 'json'
  const modelName = getModelName(modelCode)
  const chars = text.length
  let tokens = 0
  try {
    tokens = modelCode ? estimateTokens(text, modelCode) : 0
  } catch {
    // 토큰 추정 실패 시 0 유지
  }
  const hasChanged = text !== value

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-md z-[300] flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[min(900px,94vw)] h-[min(680px,88vh)] bg-card border border-border rounded-2xl flex flex-col shadow-float-lg animate-expand-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-muted border-b border-border rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] font-semibold text-foreground">{title}</span>
            <span className="text-[10px] px-2 py-[2px] bg-accent text-muted-foreground rounded-md font-mono">
              {badge}
            </span>
          </div>
          <button
            onClick={onClose}
            title="닫기"
            className="w-7 h-7 flex items-center justify-center bg-transparent text-muted-foreground border border-border rounded-lg cursor-pointer hover:bg-red-600/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/30 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Editor body */}
        <div className="flex-1 overflow-hidden">
          <EditorErrorBoundary>
            <MonacoEditor
              height="100%"
              language={isPrompt ? 'plaintext' : 'json'}
              theme={monacoTheme}
              value={text}
              onChange={(val) => setText(val ?? '')}
              options={{
                minimap: { enabled: false },
                wordWrap: 'on',
                fontSize: 13,
                lineHeight: 1.7,
                padding: { top: 16 },
              }}
            />
          </EditorErrorBoundary>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-muted border-t border-border rounded-b-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] px-2.5 py-1 bg-accent text-sky-700 dark:text-sky-400 rounded-md font-mono">
              {modelName}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
              {chars.toLocaleString()} chars · {tokens.toLocaleString()} tokens
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-[7px] bg-accent text-muted-foreground border border-border rounded-xl text-[13px] cursor-pointer hover:bg-secondary transition-all"
            >
              취소
            </button>
            <button
              onClick={handleApply}
              disabled={!hasChanged}
              className="px-4 py-[7px] bg-card text-foreground border-none rounded-xl text-[13px] font-medium cursor-pointer hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
            >
              적용하고 닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
