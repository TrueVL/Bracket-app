import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Field } from '../components/ui';
import { useTitle } from '../hooks';

function useNext(): string {
  const [params] = useSearchParams();
  const next = params.get('next');
  // Only allow same-site relative paths.
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export function LoginPage() {
  useTitle('Log in');
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.login({ username, password });
      setUser(r.user);
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card card">
      <h1>Welcome back</h1>
      <p className="muted">Log in to make your picks and check the standings.</p>
      <form onSubmit={submit} className="stack">
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <ErrorBox error={error} />
        <button className="btn accent block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="center muted">
        New here? <Link to={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link>
      </p>
    </div>
  );
}

export function SignupPage() {
  useTitle('Sign up');
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.signup({ username, displayName: displayName || username, password });
      setUser(r.user);
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card card">
      <h1>Join Bracket Club</h1>
      <p className="muted">Free, quick, and no email needed. Your friends will see your display name.</p>
      <form onSubmit={submit} className="stack">
        <Field label="Username" hint="3–20 letters, numbers or underscores. You’ll use it to log in.">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            pattern="[A-Za-z0-9_]{3,20}"
            autoFocus
            required
          />
        </Field>
        <Field label="Display name" hint="What your friends see on the leaderboard.">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={username || 'e.g. Ville'} maxLength={40} />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
        </Field>
        <ErrorBox error={error} />
        <button className="btn accent block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="center muted">
        Already have an account? <Link to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Log in</Link>
      </p>
    </div>
  );
}
