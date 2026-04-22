export interface CstmPrmtInfo {
  cstm_id: number
  company_seq: string
  ai_staff_seq: string
  svc_cd: string
  prmt_cd: string
  status: 'Y' | 'N'
  prompt: string
  json_schema: string | null
  rgst_dt: string
  updt_dt: string
}

export interface Code {
  code: string
  up_code: string
  name_ko: string
  name_en: string
  status: string
}

export interface KBItem {
  file_name: string
  content?: string
  company_seq: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
