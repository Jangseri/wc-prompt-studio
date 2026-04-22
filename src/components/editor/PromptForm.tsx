'use client'

import { StatusToggle } from './StatusToggle'
import type { EditableFields } from '@/hooks/useChangeDetection'
import type { CodeGroup } from '@/hooks/useCodeOptions'

interface PromptFormData extends EditableFields {
  cstm_id: number | null
  rgst_dt: string
  updt_dt: string
}

interface PromptFormProps {
  data: PromptFormData
  onChange: (field: keyof EditableFields, value: string | null) => void
  isExisting?: boolean
  codeNames?: Record<string, string>
  svcGroups?: CodeGroup[]
  prmtGroups?: CodeGroup[]
}

export function PromptForm({ data, onChange, isExisting = false, codeNames = {}, svcGroups = [], prmtGroups = [] }: PromptFormProps) {
  const readonlyClass = 'px-3 py-[7px] border border-border/50 rounded-xl text-[13px] bg-muted/60 text-muted-foreground cursor-not-allowed'
  const editableClass = 'px-3 py-[7px] border border-border/70 rounded-xl text-[13px] text-foreground bg-card/80 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20 transition-all focus-ring'

  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-3.5 glass border border-border rounded-2xl p-5">
      {/* cstm_id - readonly */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">cstm_id</label>
        <input
          className={readonlyClass}
          value={data.cstm_id ?? ''}
          readOnly
          placeholder="자동생성"
        />
      </div>

      {/* company_seq */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Company Seq</label>
        <input
          className={isExisting ? readonlyClass : editableClass}
          value={data.company_seq}
          onChange={(e) => onChange('company_seq', e.target.value)}
          readOnly={isExisting}
          placeholder="예: COMP001"
        />
      </div>

      {/* ai_staff_seq */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">AI Staff Seq</label>
        <input
          className={isExisting ? readonlyClass : editableClass}
          value={data.ai_staff_seq}
          onChange={(e) => onChange('ai_staff_seq', e.target.value)}
          readOnly={isExisting}
          placeholder="예: STAFF01"
        />
      </div>

      {/* status */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">상태 (status)</label>
        <StatusToggle
          value={data.status as 'Y' | 'N'}
          onChange={(val) => onChange('status', val)}
        />
      </div>

      {/* svc_cd */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">서비스 코드 (svc_cd)</label>
        {isExisting ? (
          <input
            className={readonlyClass}
            value={codeNames[data.svc_cd] ? `${data.svc_cd} (${codeNames[data.svc_cd]})` : data.svc_cd}
            readOnly
          />
        ) : (
          <select
            className={editableClass}
            value={data.svc_cd}
            onChange={(e) => onChange('svc_cd', e.target.value)}
          >
            <option value="">선택...</option>
            {svcGroups.map((g) => (
              <optgroup key={g.groupLabel} label={g.groupLabel}>
                {g.options.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {'\u00A0'.repeat(opt.depth * 2)}{opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {/* prmt_cd */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">프롬프트 코드 (prmt_cd)</label>
        {isExisting ? (
          <input
            className={readonlyClass}
            value={codeNames[data.prmt_cd] ? `${data.prmt_cd} (${codeNames[data.prmt_cd]})` : data.prmt_cd}
            readOnly
          />
        ) : (
          <select
            className={editableClass}
            value={data.prmt_cd}
            onChange={(e) => onChange('prmt_cd', e.target.value)}
          >
            <option value="">선택...</option>
            {prmtGroups.map((g) => (
              <optgroup key={g.groupLabel} label={g.groupLabel}>
                {g.options.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {'\u00A0'.repeat(opt.depth * 2)}{opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {/* rgst_dt - readonly */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">등록일 (rgst_dt)</label>
        <input
          className={readonlyClass}
          value={data.rgst_dt}
          readOnly
          placeholder="-"
        />
      </div>

      {/* updt_dt - readonly */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">수정일 (updt_dt)</label>
        <input
          className={readonlyClass}
          value={data.updt_dt}
          readOnly
          placeholder="-"
        />
      </div>
    </div>
  )
}
