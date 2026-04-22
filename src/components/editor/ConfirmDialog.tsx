'use client'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  loading?: boolean
}

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="glass border border-white/50 rounded-2xl p-6 w-[380px] shadow-float-lg animate-expand-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold text-foreground mb-1.5">{title}</h3>
        <p className="text-muted-foreground text-[13px] mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-[7px] bg-card/60 border border-border/60 rounded-xl cursor-pointer text-[13px] font-medium text-muted-foreground hover:bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-[7px] rounded-xl cursor-pointer text-[13px] font-medium text-primary-foreground transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-600'
                : 'bg-primary hover:bg-primary/80'
            }`}
          >
            {loading && (
              <div className="w-3.5 h-3.5 border-[1.5px] border-border border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
