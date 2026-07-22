import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Something went wrong',
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer error boundary:', error, info.componentStack)
    void window.electronAPI.invoke('error:report', {
      message: error.message,
      stack: info.componentStack ?? error.stack,
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="error-boundary">
        <h1>Clarifi hit a snag</h1>
        <p>{this.state.message}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload app
        </button>
      </div>
    )
  }
}
