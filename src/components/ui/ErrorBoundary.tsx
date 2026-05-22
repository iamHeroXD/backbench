"use client";

import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State { return { hasError: true }; }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[40vh] flex flex-col items-center justify-center px-6 text-center">
          <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-4">
            <RefreshCw size={14} className="text-[#555]" />
          </div>
          <p className="text-[#888] text-sm mb-1">Something went wrong.</p>
          <p className="text-[#444] text-xs mb-4">This section failed to load.</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="text-[#4a7aa8] text-xs hover:text-[#5a8ab8] transition-colors"
          >
            reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
