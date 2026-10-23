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
  /** Where it broke: the innermost components, so a phone screenshot is enough to find the bug. */
  where?: string
}

/** "at Foo (…)\n at Bar (…)" -> "Foo < Bar < Baz" */
export function crashPlace(componentStack?: string | null): string {
  const names = (componentStack ?? '').split('\n').map((l) => /^\s*(?:at\s+)?([A-Za-z_$][\w$]*)/.exec(l)?.[1]).filter((n): n is string => !!n && n !== 'at')
  return names.slice(0, 4).join(' < ')
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
    return { error, where: undefined }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { key: props.resetKey, error: null } : null
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[${this.props.name}] crashed:`, error, info.componentStack)
    const frame = /[\w.-]+\.js:\d+:\d+/.exec(error.stack ?? '')?.[0]
    this.setState({ where: [crashPlace(info.componentStack), frame].filter(Boolean).join(' · ') })
  }

  render() {
    const { error, where } = this.state
    if (!error) return this.props.children
    const v = vi()
    return (
      <div className="panel-guard" role="alert">
        <b>{v ? `Phần "${this.props.name}" bị lỗi` : `The ${this.props.name} panel hit an error`}</b>
        <code>{error.message || String(error)}</code>
        {where && <code className="muted small">{v ? 'Ở' : 'In'}: {where}</code>}
        <button onClick={() => this.setState({ error: null })}>{v ? 'Thử lại' : 'Try again'}</button>
      </div>
    )
  }
}
