import { Component, type ReactNode } from 'react'

interface Props {
  name: string
  children: ReactNode
  /** Changes when the user picks something new, so the panel tries again on its own. */
  resetKey?: string
}

interface State {
  error: Error | null
  key?: string
}

const vi = () => {
  try {
    return localStorage.getItem('bluechip.lang') === 'vi'
  } catch {
    return false
  }
}

/** Keeps one broken panel from blacking out the whole app: shows the error in its place with a retry button. */
export class PanelGuard extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { key: props.resetKey, error: null } : null
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[${this.props.name}] crashed:`, error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const v = vi()
    return (
      <div className="panel-guard" role="alert">
        <b>{v ? `Phần "${this.props.name}" bị lỗi` : `The ${this.props.name} panel hit an error`}</b>
        <code>{error.message || String(error)}</code>
        <button onClick={() => this.setState({ error: null })}>{v ? 'Thử lại' : 'Try again'}</button>
      </div>
    )
  }
}
