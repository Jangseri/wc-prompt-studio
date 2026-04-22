'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[EditorErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-[#18181b]">
          <div className="text-center p-4">
            <p className="text-[13px] text-muted-foreground mb-2">에디터를 불러올 수 없습니다</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-3 py-1.5 text-[12px] bg-[#27272a] text-muted-foreground border border-[#333] rounded-lg cursor-pointer hover:bg-[#333] transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
