'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { PromptForm } from './PromptForm'
import { ConfirmDialog } from './ConfirmDialog'
import { ExpandModal } from './ExpandModal'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import { toast } from 'sonner'
import { useChangeDetection, type EditableFields } from '@/hooks/useChangeDetection'
import type { CstmPrmtInfo } from '@/types/editor'
import type { CodeGroup } from '@/hooks/useCodeOptions'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface PromptEditorProps {
  item: CstmPrmtInfo | null
  isCreateMode?: boolean
  defaultCompanySeq?: string
  onSaved: (updated: CstmPrmtInfo) => void
  onCreated?: (created: CstmPrmtInfo) => void
  onDeleted?: (id: number) => void
  codeNames?: Record<string, string>
  llmConfigMap?: Record<string, string>
  svcGroups?: CodeGroup[]
  prmtGroups?: CodeGroup[]
}

function toEditable(item: CstmPrmtInfo): EditableFields {
  return {
    company_seq: item.company_seq,
    ai_staff_seq: item.ai_staff_seq,
    svc_cd: item.svc_cd,
    prmt_cd: item.prmt_cd,
    status: item.status,
    prompt: item.prompt,
    json_schema: item.json_schema,
  }
}

const ExpandIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <polyline points="15 3 21 3 21 9"/>
    <polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
    <line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
)

export function PromptEditor({ item, isCreateMode = false, defaultCompanySeq = '', onSaved, onCreated, onDeleted, codeNames = {}, llmConfigMap = {}, svcGroups = [], prmtGroups = [] }: PromptEditorProps) {
  const { resolvedTheme } = useTheme()
  const monacoTheme = resolvedTheme === 'light' ? 'vs' : 'vs-dark'
  const [originalData, setOriginalData] = useState<EditableFields | null>(null)
  const [formData, setFormData] = useState<EditableFields>({
    company_seq: '',
    ai_staff_seq: '',
    svc_cd: '',
    prmt_cd: '',
    status: 'Y',
    prompt: '',
    json_schema: null,
  })
  const [meta, setMeta] = useState({ cstm_id: null as number | null, rgst_dt: '', updt_dt: '' })

  const [showConfirmSave, setShowConfirmSave] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [expandTarget, setExpandTarget] = useState<'prompt' | 'json' | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { isDirty } = useChangeDetection(originalData, formData)

  useEffect(() => {
    if (isCreateMode) {
      const empty: EditableFields = {
        company_seq: defaultCompanySeq,
        ai_staff_seq: '',
        svc_cd: '',
        prmt_cd: '',
        status: 'Y',
        prompt: '',
        json_schema: null,
      }
      setOriginalData(empty)
      setFormData(empty)
      setMeta({ cstm_id: null, rgst_dt: '', updt_dt: '' })
    } else if (item) {
      const editable = toEditable(item)
      setOriginalData(editable)
      setFormData(editable)
      setMeta({ cstm_id: item.cstm_id, rgst_dt: item.rgst_dt, updt_dt: item.updt_dt })
    } else {
      setOriginalData(null)
    }
  }, [item, isCreateMode, defaultCompanySeq])

  const handleFieldChange = useCallback((field: keyof EditableFields, value: string | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const showToast = (msg: string, variant: 'success' | 'error' = 'success') => {
    if (variant === 'error') toast.error(msg)
    else toast.success(msg)
  }

  const handleSave = async () => {
    setShowConfirmSave(false)

    if (isCreateMode) {
      setSaving(true)
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 15000)
        const res = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
          signal: controller.signal,
        })
        clearTimeout(timer)
        const data = await res.json()
        if (data.success) {
          const created = data.data as CstmPrmtInfo
          showToast('생성되었습니다')
          onCreated?.(created)
        } else {
          showToast(data.error || '생성 실패', 'error')
        }
      } catch (err) {
        const msg = err instanceof DOMException && err.name === 'AbortError'
          ? '저장 요청 시간이 초과되었습니다. 다시 시도해 주세요.'
          : '네트워크 오류로 저장에 실패했습니다. 다시 시도해 주세요.'
        showToast(msg, 'error')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!item) return

    setSaving(true)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(`/api/prompts/${item.cstm_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, _updt_dt: meta.updt_dt }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.success) {
        const updated = data.data as CstmPrmtInfo
        const editable = toEditable(updated)
        setOriginalData(editable)
        setFormData(editable)
        setMeta({ cstm_id: updated.cstm_id, rgst_dt: updated.rgst_dt, updt_dt: updated.updt_dt })
        showToast('저장되었습니다')
        onSaved(updated)
      } else {
        showToast(data.error || '저장 실패', 'error')
      }
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError'
        ? '저장 요청 시간이 초과되었습니다. 다시 시도해 주세요.'
        : '네트워크 오류로 저장에 실패했습니다. 다시 시도해 주세요.'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!item) return
    setDeleting(true)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(`/api/prompts/${item.cstm_id}`, {
        method: 'DELETE',
        signal: controller.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.success) {
        setShowConfirmDelete(false)
        showToast('삭제되었습니다')
        onDeleted?.(item.cstm_id)
      } else {
        setShowConfirmDelete(false)
        showToast(data.error || '삭제 실패', 'error')
      }
    } catch (err) {
      setShowConfirmDelete(false)
      const msg = err instanceof DOMException && err.name === 'AbortError'
        ? '삭제 요청 시간이 초과되었습니다'
        : '네트워크 오류로 삭제에 실패했습니다'
      showToast(msg, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleExpandApply = useCallback((value: string) => {
    if (expandTarget === 'prompt') {
      handleFieldChange('prompt', value)
    } else if (expandTarget === 'json') {
      handleFieldChange('json_schema', value || null)
    }
    setExpandTarget(null)
    showToast('편집 내용이 적용되었습니다')
  }, [expandTarget, handleFieldChange])

  const isJsonNull = formData.json_schema === null

  const isCreateValid = !!(formData.company_seq && formData.ai_staff_seq && formData.svc_cd && formData.prmt_cd && formData.prompt)

  if (!item && !isCreateMode) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <div className="text-[14px] font-medium text-muted-foreground">프롬프트를 선택하세요</div>
        <div className="text-[13px] text-muted-foreground">좌측 목록에서 항목을 클릭하거나 새 프롬프트를 만드세요</div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      {/* Editor header */}
      <div className="glass border-b border-border px-6 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {isCreateMode ? (
            <span className="text-[14px] font-semibold text-foreground tracking-tight">새 프롬프트</span>
          ) : (
            <>
              <span className="text-[14px] font-semibold text-foreground tracking-tight">
                {codeNames[formData.svc_cd] || formData.svc_cd}
                <span className="text-muted-foreground font-normal mx-1">/</span>
                {codeNames[formData.prmt_cd] || formData.prmt_cd}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formData.company_seq} · {formData.ai_staff_seq}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">ID: {meta.cstm_id}</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {!isCreateMode && (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="px-3.5 py-[7px] bg-card/80 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800/40 rounded-xl text-[13px] font-medium cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-400 dark:hover:border-red-600 transition-all"
            >
              삭제
            </button>
          )}
          <button
            onClick={() => setShowConfirmSave(true)}
            disabled={isCreateMode ? !isCreateValid || saving : !isDirty || saving}
            className="px-4 py-[7px] bg-primary text-primary-foreground border-none rounded-xl text-[13px] font-medium cursor-pointer hover:bg-primary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
          >
            {isCreateMode ? '저장' : '수정'}
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <PromptForm
          data={{ ...formData, cstm_id: meta.cstm_id, rgst_dt: meta.rgst_dt, updt_dt: meta.updt_dt }}
          onChange={handleFieldChange}
          isExisting={!isCreateMode && meta.cstm_id !== null}
          codeNames={codeNames}
          svcGroups={svcGroups}
          prmtGroups={prmtGroups}
        />

        {/* Editors row */}
        <div className="grid grid-cols-[3fr_2fr] gap-3.5 flex-1 min-h-0">
          {/* Prompt editor */}
          <div className="flex flex-col bg-card border border-border rounded-2xl overflow-hidden -lg">
            <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border flex-shrink-0">
              <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">Prompt</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-[2px] bg-accent text-muted-foreground rounded-md font-mono">plaintext</span>
                <button
                  onClick={() => setExpandTarget('prompt')}
                  title="확장 편집"
                  className="flex items-center gap-1 px-2 py-[3px] bg-transparent text-muted-foreground border border-border rounded-md text-[10px] cursor-pointer hover:bg-accent hover:text-muted-foreground transition-colors"
                >
                  <ExpandIcon />
                  확장
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-[200px]">
              <EditorErrorBoundary>
                <MonacoEditor
                  height="100%"
                  language="plaintext"
                  theme={monacoTheme}
                  value={formData.prompt}
                  onChange={(val) => handleFieldChange('prompt', val ?? '')}
                  data-testid="prompt"
                  options={{ minimap: { enabled: false }, wordWrap: 'on', fontSize: 13, lineHeight: 1.7, padding: { top: 8 } }}
                />
              </EditorErrorBoundary>
            </div>
          </div>

          {/* JSON Schema editor */}
          <div className="flex flex-col bg-card border border-border rounded-2xl overflow-hidden -lg relative">
            <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border flex-shrink-0">
              <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">JSON Schema</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleFieldChange('json_schema', isJsonNull ? '' : null)}
                  title="NULL 전환"
                  className={`text-[10px] px-2 py-[2px] border rounded-md cursor-pointer font-mono transition-all ${
                    isJsonNull
                      ? 'bg-red-600/10 text-red-600 dark:text-red-400 border-red-500/30'
                      : 'bg-transparent text-muted-foreground border-border hover:text-muted-foreground'
                  }`}
                >
                  NULL
                </button>
                <span className="text-[10px] px-2 py-[2px] bg-accent text-muted-foreground rounded-md font-mono">json</span>
                <button
                  onClick={() => !isJsonNull && setExpandTarget('json')}
                  title="확장 편집"
                  className={`flex items-center gap-1 px-2 py-[3px] bg-transparent text-muted-foreground border border-border rounded-md text-[10px] cursor-pointer hover:bg-accent hover:text-muted-foreground transition-colors ${
                    isJsonNull ? 'opacity-30 pointer-events-none' : ''
                  }`}
                >
                  <ExpandIcon />
                  확장
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-[200px] relative">
              <EditorErrorBoundary>
                <MonacoEditor
                  height="100%"
                  language="json"
                  theme={monacoTheme}
                  value={formData.json_schema ?? ''}
                  onChange={(val) => handleFieldChange('json_schema', val || null)}
                  data-testid="json-schema"
                  options={{ minimap: { enabled: false }, wordWrap: 'on', fontSize: 13, lineHeight: 1.7, readOnly: isJsonNull, padding: { top: 8 } }}
                />
              </EditorErrorBoundary>
              {/* NULL overlay */}
              {isJsonNull && (
                <div className="absolute inset-0 glass-dark flex flex-col items-center justify-center gap-3 z-10">
                  <span className="font-mono text-2xl font-bold text-muted-foreground tracking-[0.15em] opacity-40 select-none">NULL</span>
                  <span className="text-[13px] text-muted-foreground">지정된 JSON Schema가 없습니다.</span>
                  <button
                    onClick={() => handleFieldChange('json_schema', '')}
                    className="mt-1 px-4 py-2 bg-card text-foreground border-none rounded-xl text-[13px] font-medium cursor-pointer hover:bg-secondary active:scale-[0.97] transition-all "
                  >
                    스키마 작성하기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expand Modal */}
      <ExpandModal
        open={expandTarget !== null}
        target={expandTarget}
        value={expandTarget === 'prompt' ? formData.prompt : (formData.json_schema ?? '')}
        modelCode={llmConfigMap[`${formData.svc_cd}|${formData.prmt_cd}`] || null}
        onApply={handleExpandApply}
        onClose={() => setExpandTarget(null)}
      />

      {/* Confirm save dialog */}
      <ConfirmDialog
        open={showConfirmSave}
        title="변경사항 저장"
        message="변경사항을 저장하시겠습니까?"
        confirmLabel="확인"
        onConfirm={handleSave}
        onCancel={() => setShowConfirmSave(false)}
      />

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={showConfirmDelete}
        title="프롬프트 삭제"
        message="이 프롬프트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirmDelete(false)}
        loading={deleting}
      />

    </main>
  )
}
