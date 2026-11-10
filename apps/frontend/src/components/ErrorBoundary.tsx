import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="space-y-4">
        <h1 className="text-2xl font-semibold">Coś poszło nie tak</h1>
        <p className="text-sm text-zinc-400">{this.state.error.message}</p>
        <button
          className="cursor-pointer rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
          onClick={() => window.location.reload()}
        >
          Odśwież stronę
        </button>
      </div>
    );
  }
}
