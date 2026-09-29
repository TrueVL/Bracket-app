import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { NotFound, Spinner } from './components/ui';
import { Account } from './pages/Account';
import { LoginPage, SignupPage } from './pages/Auth';
import { BracketPage } from './pages/BracketPage';
import { Home } from './pages/Home';
import { JoinPage } from './pages/Join';
import { NewPool } from './pages/NewPool';
import { PoolPage } from './pages/Pool';
import { PoolBracket } from './pages/PoolBracket';
import { PoolResults } from './pages/PoolResults';
import { PoolSettings } from './pages/PoolSettings';
import { PoolTeams } from './pages/PoolTeams';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

function Header({ wide }: { wide: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="site-header">
      <div className={`wrap header-inner${wide ? ' wide' : ''}`}>
        <Link to="/" className="logo">
          <span className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="28" height="28">
              <path d="M12 14h14v11h13v14H26v11H12" fill="none" stroke="#f59e0b" strokeWidth="6" strokeLinejoin="round" />
              <path d="M40 32h13" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="logo-text">Bracket Club</span>
        </Link>
        <nav className="nav">
          {user ? (
            <>
              <NavLink to="/" end>
                My pools
              </NavLink>
              <NavLink to="/pools/new" className="hide-sm">
                New pool
              </NavLink>
              <button
                type="button"
                className="link-btn hide-sm"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                Log out
              </button>
              <NavLink to="/account" className="nav-avatar" title={`${user.displayName} · account`} aria-label="Your account">
                {user.displayName.slice(0, 1).toUpperCase()}
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/signup" className="btn small accent">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export function App() {
  const { pathname } = useLocation();
  const wide = /^\/(brackets\/|pools\/[^/]+\/(bracket|results)$)/.test(pathname);
  return (
    <>
      <ScrollToTop />
      <Header wide={wide} />
      <main className={`wrap main${wide ? ' wide' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/brackets/:id" element={<BracketPage />} />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <Account />
              </RequireAuth>
            }
          />
          <Route
            path="/pools/new"
            element={
              <RequireAuth>
                <NewPool />
              </RequireAuth>
            }
          />
          <Route
            path="/pools/:id"
            element={
              <RequireAuth>
                <PoolPage />
              </RequireAuth>
            }
          />
          <Route
            path="/pools/:id/bracket"
            element={
              <RequireAuth>
                <PoolBracket />
              </RequireAuth>
            }
          />
          <Route
            path="/pools/:id/teams"
            element={
              <RequireAuth>
                <PoolTeams />
              </RequireAuth>
            }
          />
          <Route
            path="/pools/:id/results"
            element={
              <RequireAuth>
                <PoolResults />
              </RequireAuth>
            }
          />
          <Route
            path="/pools/:id/settings"
            element={
              <RequireAuth>
                <PoolSettings />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className={`site-footer wrap${wide ? ' wide' : ''}`}>
        <span>Bracket Club · made for friendly competition</span>
        <span className="muted">Not affiliated with any league. Team names belong to their owners.</span>
      </footer>
    </>
  );
}
