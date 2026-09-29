import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Field } from '../components/ui';
import { useTitle } from '../hooks';

export function Account() {
  useTitle('Account');
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user!.displayName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: FormEvent, body: Parameters<typeof api.updateMe>[0], message: string) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const r = await api.updateMe(body);
      setUser(r.user);
      setNotice(message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="narrow-page stack">
      <h1>Your account</h1>
      <div className="row between wrap-row">
        <p className="muted">
          Logged in as <strong>@{user!.username}</strong>
        </p>
        <button
          type="button"
          className="btn small"
          onClick={async () => {
            await logout();
            navigate('/');
          }}
        >
          Log out
        </button>
      </div>
      <ErrorBox error={error} />
      {notice && <div className="alert success">{notice}</div>}
      <form className="card stack form-card" onSubmit={(e) => submit(e, { displayName }, 'Display name updated.')}>
        <h2>Profile</h2>
        <Field label="Display name" hint="Shown on leaderboards.">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} required />
        </Field>
        <div>
          <button className="btn accent">Save</button>
        </div>
      </form>
      <form className="card stack form-card" onSubmit={(e) => submit(e, { currentPassword, newPassword }, 'Password changed.')}>
        <h2>Change password</h2>
        <Field label="Current password">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <div>
          <button className="btn">Change password</button>
        </div>
      </form>
    </div>
  );
}
