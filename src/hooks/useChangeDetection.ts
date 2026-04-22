import { useMemo } from 'react'

export interface EditableFields {
  company_seq: string
  ai_staff_seq: string
  svc_cd: string
  prmt_cd: string
  status: string
  prompt: string
  json_schema: string | null
}

const COMPARED_KEYS: (keyof EditableFields)[] = [
  'company_seq',
  'ai_staff_seq',
  'svc_cd',
  'prmt_cd',
  'status',
  'prompt',
  'json_schema',
]

export function useChangeDetection(
  original: EditableFields | null,
  current: EditableFields
): { isDirty: boolean; changedFields: string[] } {
  return useMemo(() => {
    if (!original) return { isDirty: false, changedFields: [] }

    const changedFields = COMPARED_KEYS.filter(
      (key) => original[key] !== current[key]
    )

    return {
      isDirty: changedFields.length > 0,
      changedFields,
    }
  }, [original, current])
}
