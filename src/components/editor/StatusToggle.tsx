'use client'

interface StatusToggleProps {
  value: 'Y' | 'N'
  onChange: (val: 'Y' | 'N') => void
}

export function StatusToggle({ value, onChange }: StatusToggleProps) {
  return (
    <div className="flex gap-1.5">
      <div
        onClick={() => onChange('Y')}
        className={`flex-1 py-[7px] rounded-xl text-[13px] font-medium cursor-pointer text-center transition-all duration-200 ${
          value === 'Y'
            ? 'active bg-emerald-600 text-primary-foreground '
            : 'bg-secondary/80 text-muted-foreground hover:bg-secondary/60 hover:text-muted-foreground'
        }`}
      >
        Y (활성)
      </div>
      <div
        onClick={() => onChange('N')}
        className={`flex-1 py-[7px] rounded-xl text-[13px] font-medium cursor-pointer text-center transition-all duration-200 ${
          value === 'N'
            ? 'active bg-red-600 text-primary-foreground '
            : 'bg-secondary/80 text-muted-foreground hover:bg-secondary/60 hover:text-muted-foreground'
        }`}
      >
        N (비활성)
      </div>
    </div>
  )
}
