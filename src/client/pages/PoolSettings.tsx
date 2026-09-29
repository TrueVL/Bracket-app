import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PoolDetail } from '../../shared/api';
import type { Scoring, Template } from '../../shared/types';
import { api } from '../api';
import { useAuth } from '../auth';
import { ScoringEditor } from '../components/ScoringEditor';
import { ErrorBox, Field, formatDate, fromLocalInput, NotFound, Spinner, toLocalInput } from '../components/ui';
import { useTitle } from '../hooks';
import { usePool } from '../usePool';
import { PoolHeader } from './Pool';

function OwnerSettings({ pool, template, onSaved }: { pool: PoolDetail; template: Template; onSaved: (p: PoolDetail) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(pool.name);
  const [season, setSeason] = useState(pool.season);
  const [lockAt, setLockAt] = useState(toLocalInput(pool.lockAt));
  const [scoring, setScoring] = useState<Scoring>(pool.scoring);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ pool: PoolDetail }>, message: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { pool: next } = await fn();
      onSaved(next);
      setLockAt(toLocalInput(next.lockAt));
      setNotice(message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => api.updatePool(pool.id, { name, season, lockAt: fromLocalInput(lockAt), scoring }), 'Settings saved.');
  };

  return (
    <>
      <form className="card stack form-card" onSubmit={submit}>
        <h2>Pool settings</h2>
        <div className="grid-2">
          <Field label="Pool name">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          </Field>
          <Field label="Season">
            <input value={season} onChange={(e) => setSeason(e.target.value)} maxLength={20} />
          </Field>
        </div>
        <Field
          label="Picks lock at"
          hint={
            pool.locked
              ? `Locked since ${formatDate(pool.lockAt!)}. Clear or move this date to reopen picks.`
              : 'After this time brackets can’t change and everyone can see each other’s picks.'
          }
        >
          <div className="row">
            <input type="datetime-local" value={lockAt} onChange={(e) => setLockAt(e.target.value)} />
            {!pool.locked ? (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() =>
                  window.confirm('Lock picks now? Nobody will be able to change their bracket.') &&
                  run(() => api.updatePool(pool.id, { lockAt: Date.now() }), 'Picks are locked.')
                }
              >
                Lock now
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => run(() => api.updatePool(pool.id, { lockAt: null }), 'Picks are open again.')}
              >
                Unlock
              </button>
            )}
          </div>
        </Field>
        <div>
          <h3>Scoring</h3>
          <ScoringEditor template={template} value={scoring} onChange={setScoring} />
        </div>
        <ErrorBox error={error} />
        {notice && <div className="alert success">{notice}</div>}
        <div>
          <button className="btn accent" disabled={busy}>
            Save settings
          </button>
        </div>
      </form>

      <div className="card stack">
        <h2>Invite link</h2>
        <p className="muted small">
          Current code: <strong className="mono">{pool.inviteCode}</strong>. Resetting it makes old links stop working; members who
          already joined stay in.
        </p>
        <div>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => run(() => api.resetInvite(pool.id), 'New invite link created.')}
          >
            Reset invite link
          </button>
        </div>
      </div>

      <div className="card stack danger-zone">
        <h2>Danger zone</h2>
        <p className="muted small">Deleting the pool removes every bracket in it. This can’t be undone.</p>
        <div>
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              if (window.prompt(`Type the pool name to delete it: ${pool.name}`) !== pool.name) return;
              await api.deletePool(pool.id);
              navigate('/');
            }}
          >
            Delete pool
          </button>
        </div>
      </div>
    </>
  );
}

function Members({ pool, onChange }: { pool: PoolDetail; onChange: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const remove = async (userId: string, name: string, self: boolean) => {
    const msg = self ? 'Leave this pool? Your bracket will be deleted.' : `Remove ${name} and their bracket from the pool?`;
    if (!window.confirm(msg)) return;
    try {
      await api.removeMember(pool.id, userId);
      if (self) navigate('/');
      else onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="card stack">
      <h2>Members</h2>
      <ErrorBox error={error} />
      <ul className="member-list">
        {pool.leaderboard.map((m) => (
          <li key={m.userId}>
            <span className="avatar" aria-hidden="true">
              {m.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="grow">
              {m.displayName} <span className="muted small">@{m.username}</span>
              {m.isOwner && <span className="tag">commish</span>}
            </div>
            {pool.isOwner && !m.isOwner && (
              <button type="button" className="btn small ghost danger" onClick={() => remove(m.userId, m.displayName, false)}>
                Remove
              </button>
            )}
            {!pool.isOwner && m.userId === user?.id && (
              <button type="button" className="btn small ghost danger" onClick={() => remove(m.userId, m.displayName, true)}>
                Leave pool
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PoolSettings() {
  const { pool, template, error, loading, setData, reload } = usePool();
  useTitle(pool ? `Settings · ${pool.name}` : 'Settings');
  if (loading && !pool) return <Spinner />;
  if (error && !pool) return <NotFound message="This pool doesn’t exist, or you’re not a member." />;
  if (!pool || !template) return null;

  return (
    <div>
      <PoolHeader pool={pool} template={template} active="settings" />
      <div className="stack narrow-page">
        {pool.isOwner && <OwnerSettings key={pool.id} pool={pool} template={template} onSaved={setData} />}
        <Members pool={pool} onChange={reload} />
      </div>
    </div>
  );
}
