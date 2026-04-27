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
        <div className="h-full flex items-center justify-center bg-card">
          <div className="text-center p-4">
            <p className="text-[13px] text-muted-foreground mb-2">에디터를 불러올 수 없습니다</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-3 py-1.5 text-[12px] bg-muted text-muted-foreground border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors"
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
