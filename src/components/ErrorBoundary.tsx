import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Keeps one broken screen from taking the whole app down mid-workout. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FitHub render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center px-6 bg-bg">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-danger-soft grid place-items-center text-danger">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-xl font-bold">This screen hit an error</h1>
          <p className="text-sm text-ink-3 mt-2 leading-relaxed">
            Your logged data is safe — it is stored as you enter it, not when a page renders.
          </p>
          <pre className="mt-4 text-2xs text-left text-ink-3 bg-surface-2 border border-line rounded-xl p-3 overflow-auto max-h-40">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="h-10 px-4 rounded-xl border border-line text-sm font-semibold hover:bg-surface-2"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="h-10 px-4 rounded-xl bg-brand text-brand-contrast text-sm font-semibold"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
