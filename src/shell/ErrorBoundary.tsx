import { Component, type ReactNode } from 'react';

/**
 * If a page throws while rendering, show a calm recovery message in its place instead of a
 * blank screen. The rest of the site (header, footer, navigation) keeps working.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    // navigating to another page clears the error
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  componentDidCatch(error: unknown) {
    console.warn('Page failed to render:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="wrap notfound" role="alert">
        <p className="label">Something went wrong</p>
        <h1>This screen hit a problem.</h1>
        <p className="pagehead__lede">
          Nothing was lost: the simulated day is saved in this browser. Reload to try again, or reset the day if it keeps happening.
        </p>
        <div className="hero-field__ctas">
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload this page
          </button>
          <button
            className="btn btn--quiet"
            onClick={() => {
              try {
                sessionStorage.clear();
              } catch {
                /* storage unavailable: a reload still starts fresh */
              }
              window.location.assign('/');
            }}
          >
            Start a fresh day
          </button>
        </div>
      </section>
    );
  }
}
