'use client'

import { useState } from 'react'
import type { CstmPrmtInfo, KBItem } from '@/types/editor'

export type SidebarTab = 'prompt' | 'kb'

interface PromptListProps {
  items: CstmPrmtInfo[]
  selectedId: number | null
  onSelect: (item: CstmPrmtInfo) => void
  onSearch: (companySeq: string) => void
  onReset: () => void
  onCreate?: () => void
  loading: boolean
  codeNames?: Record<string, string>
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  kbItems: KBItem[]
  selectedKBId: string | null
  onSelectKB: (item: KBItem) => void
  kbLoading: boolean
}

export function PromptList({ items, selectedId, onSelect, onSearch, onReset, onCreate, loading, codeNames = {}, activeTab, onTabChange, kbItems, selectedKBId, onSelectKB, kbLoading }: PromptListProps) {
  const [filterValue, setFilterValue] = useState('')

  const handleSearch = () => {
    onSearch(filterValue)
  }

  const handleReset = () => {
    setFilterValue('')
    onReset()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <aside className="w-[290px] flex-shrink-0 glass border-r border-border flex flex-col">
      {/* Filter */}
      <div className="p-3.5 border-b border-border/40">
        <div className="bg-muted/60 rounded-2xl p-3.5 border border-border/40">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-2.5 flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            필터
          </h3>
          <div className="mb-2.5">
            <label className="block text-[10px] text-muted-foreground mb-1 font-medium">Company Seq</label>
            <input
              type="text"
              className="w-full px-3 py-[7px] border border-border/70 rounded-xl text-[13px] bg-card/80 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20 transition-all placeholder:text-muted-foreground focus-ring"
              placeholder="company seq 입력"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex-1 py-[7px] bg-primary text-primary-foreground border-none rounded-xl text-[13px] font-medium cursor-pointer hover:bg-primary/80 disabled:opacity-40 transition-all active:scale-[0.97]"
            >
              검색
            </button>
            <button
              onClick={handleReset}
              className="px-3.5 py-[7px] bg-card text-muted-foreground border border-border/70 rounded-xl text-[13px] cursor-pointer hover:bg-muted hover:text-foreground transition-all"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex border-b border-border/40">
        <button
          onClick={() => onTabChange('prompt')}
          className={`flex-1 py-2.5 text-[12px] font-semibold transition-all border-b-2 ${
            activeTab === 'prompt'
              ? 'text-primary border-primary bg-primary/10'
              : 'text-muted-foreground border-transparent hover:text-muted-foreground hover:bg-muted/50'
          }`}
        >
          프롬프트
        </button>
        <button
          onClick={() => onTabChange('kb')}
          className={`flex-1 py-2.5 text-[12px] font-semibold transition-all border-b-2 ${
            activeTab === 'kb'
              ? 'text-primary border-primary bg-primary/10'
              : 'text-muted-foreground border-transparent hover:text-muted-foreground hover:bg-muted/50'
          }`}
        >
          Knowledge Base
        </button>
      </div>

      {/* List header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
        <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
          {activeTab === 'prompt' ? `${items.length}개 항목` : `${kbItems.length}개 항목`}
        </span>
        {activeTab === 'prompt' && onCreate && (
          <button
            onClick={onCreate}
            className="flex items-center gap-1 px-2.5 py-[5px] bg-emerald-600 text-primary-foreground border-none rounded-lg text-[11px] font-medium cursor-pointer hover:bg-emerald-600 transition-all active:scale-[0.97]"
          >
            ＋ 새 프롬프트
          </button>
        )}
      </div>

      {/* List items */}
      <div className="overflow-y-auto flex-1">
        {activeTab === 'prompt' ? (
          <>
            {items.map((item) => (
              <div
                key={item.cstm_id}
                data-testid="list-item"
                onClick={() => onSelect(item)}
                className={`group px-4 py-3 border-b border-border cursor-pointer transition-all duration-150 ${
                  selectedId === item.cstm_id
                    ? 'bg-primary/15 border-l-[2.5px] border-l-primary'
                    : 'hover:bg-muted/60'
                }`}
              >
                <div className={`text-[13px] font-semibold mb-1 transition-colors ${
                  selectedId === item.cstm_id ? 'text-primary' : 'text-foreground group-hover:text-foreground'
                }`}>
                  {codeNames[item.svc_cd] || item.svc_cd}
                  <span className="text-muted-foreground font-normal mx-0.5">/</span>
                  {codeNames[item.prmt_cd] || item.prmt_cd}
                </div>
                <div className="flex gap-1 flex-wrap items-center">
                  <span className="text-[10px] text-muted-foreground">
                    {item.company_seq} · {item.ai_staff_seq}
                  </span>
                  <span
                    className={`inline-block px-[7px] py-[2px] rounded-md text-[10px] font-semibold ${
                      item.status === 'Y'
                        ? 'bg-emerald-600/8 text-emerald-400'
                        : 'bg-red-600/8 text-red-500'
                    }`}
                  >
                    {item.status === 'Y' ? '활성' : '비활성'}
                  </span>
                </div>
              </div>
            ))}
            {items.length === 0 && !loading && (
              <div className="p-10 text-center text-muted-foreground text-[13px]">
                <div className="w-10 h-10 mx-auto mb-3 rounded-2xl bg-secondary flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                검색 결과가 없습니다
              </div>
            )}
          </>
        ) : (
          <>
            {kbItems.map((kb) => (
              <div
                key={kb.file_name}
                onClick={() => onSelectKB(kb)}
                className={`group px-4 py-3 border-b border-border cursor-pointer transition-all duration-150 ${
                  selectedKBId === kb.file_name
                    ? 'bg-primary/15 border-l-[2.5px] border-l-primary'
                    : 'hover:bg-muted/60'
                }`}
              >
                <div className={`text-[13px] font-semibold mb-1 transition-colors truncate ${
                  selectedKBId === kb.file_name ? 'text-primary' : 'text-foreground group-hover:text-foreground'
                }`}>
                  {kb.file_name}
                </div>
                <div className="flex gap-1 flex-wrap items-center">
                  <span className="text-[10px] text-muted-foreground">
                    {kb.company_seq}
                  </span>
                </div>
              </div>
            ))}
            {kbItems.length === 0 && !kbLoading && (
              <div className="p-10 text-center text-muted-foreground text-[13px]">
                <div className="w-10 h-10 mx-auto mb-3 rounded-2xl bg-secondary flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                KB 항목이 없습니다
              </div>
            )}
          </>
        )}
        {((activeTab === 'prompt' && loading) || (activeTab === 'kb' && kbLoading)) && (
          <div className="p-10 text-center text-muted-foreground text-[13px]">
            <div className="inline-block w-5 h-5 border-[1.5px] border-border border-t-indigo-500 rounded-full animate-spin mb-2" />
            <div>로딩 중...</div>
          </div>
        )}
      </div>
    </aside>
  )
}
