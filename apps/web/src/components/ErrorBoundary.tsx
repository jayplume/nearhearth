import { Component, type ReactNode } from "react";

/** If a page throws while rendering, show a way back instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page">
        <div className="wrap">
          <h1>The page tripped over a log.</h1>
          <p className="lead">Something on this page failed to draw: {this.state.error.message}. The contract is fine; this is only the page.</p>
          <button type="button" className="btn btn--ember" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </div>
      </main>
    );
  }
}
