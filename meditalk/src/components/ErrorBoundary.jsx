import React from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Uncaught React render error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;
      return (
        <div className="min-h-screen bg-gradient-to-br from-cream via-white to-sage/10 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white/80 backdrop-blur-md border border-danger/20 rounded-2xl shadow-xl p-6 sm:p-8 text-center animate-fade-in">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center text-danger mb-4 shadow-inner">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>

            <h1 className="text-xl font-bold text-ink mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-ink/60 mb-6">
              An unexpected display error occurred in the application. Your data and session are safe.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 transition shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sage/20 text-ink font-medium text-sm hover:bg-sage/30 transition border border-sage/40"
              >
                <Home className="w-4 h-4" />
                Return to Home
              </button>
            </div>

            {/* Expandable Technical Details */}
            <div className="border-t border-sage/20 pt-4 text-left">
              <button
                onClick={this.toggleDetails}
                className="flex items-center justify-between w-full text-xs font-semibold text-ink/50 hover:text-ink transition"
              >
                <span>Technical Details</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDetails && (
                <div className="mt-3 p-3 rounded-xl bg-ink/5 border border-ink/10 text-xs font-mono text-danger break-words max-h-48 overflow-y-auto">
                  <p className="font-bold">{error?.toString()}</p>
                  {errorInfo?.componentStack && (
                    <pre className="mt-2 text-[10px] text-ink/60 whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
