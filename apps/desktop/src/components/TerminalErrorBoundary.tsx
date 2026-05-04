import { Component, type ErrorInfo, type ReactNode } from "react";

type TerminalErrorBoundaryProps = {
  children: ReactNode;
};

type TerminalErrorBoundaryState = {
  hasError: boolean;
  message: string | null;
};

export class TerminalErrorBoundary extends Component<
  TerminalErrorBoundaryProps,
  TerminalErrorBoundaryState
> {
  state: TerminalErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: Error): TerminalErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Terminal crashed",
    };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    console.error("Terminal render error:", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-full items-center justify-center bg-[var(--terminal-bg)] p-6">
        <div className="max-w-md rounded-[var(--radius-lg)] border border-[var(--danger)]/20 bg-[var(--danger)]/8 px-5 py-4 text-center">
          <p className="text-[13px] font-medium text-[var(--text-strong)]">
            Terminal hit a runtime error
          </p>
          <p className="mt-2 text-[12px] text-[var(--danger)]">
            {this.state.message ?? "Unknown terminal error"}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, message: null });
            }}
            className="mt-4 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Retry Terminal
          </button>
        </div>
      </div>
    );
  }
}
