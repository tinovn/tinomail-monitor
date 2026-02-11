import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryFallbackProps {
  children: ReactNode;
}

interface ErrorBoundaryFallbackState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundaryFallback extends Component<
  ErrorBoundaryFallbackProps,
  ErrorBoundaryFallbackState
> {
  constructor(props: ErrorBoundaryFallbackProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-border bg-surface p-12 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-status-critical" />
          <h2 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
