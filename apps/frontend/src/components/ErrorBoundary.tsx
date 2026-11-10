import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/Button';

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
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Odśwież stronę
        </Button>
      </div>
    );
  }
}
