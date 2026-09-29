import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth';
import './styles.css';

/** Show what went wrong instead of a blank page if rendering crashes. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="wrap main">
        <div className="card stack crash">
          <h1>Something went wrong</h1>
          <p className="muted">The page hit an error. Reloading usually fixes it. If it keeps happening, send this message to whoever runs the site:</p>
          <pre>{`${error.name}: ${error.message}\n${navigator.userAgent}`}</pre>
          <div className="row">
            <button type="button" className="btn accent" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="btn" href="/">
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
