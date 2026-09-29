import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getTemplate } from '../../shared/templates';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, NotFound, Spinner, StatusPill } from '../components/ui';
import { useAsync, useTitle } from '../hooks';

export function JoinPage() {
  const { code = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading } = useAsync(() => api.invite(code), [code, user?.id]);
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  useTitle(data ? `Join ${data.pool.name}` : 'Join a pool');

  if ((loading || authLoading) && !data) return <Spinner />;
  if (error && !data) return <NotFound message={error.message} />;
  if (!data) return null;
  if (data.isMember) return <Navigate to={`/pools/${data.pool.id}`} replace />;

  const t = getTemplate(data.pool.templateId);
  const here = `/join/${code}`;

  const join = async () => {
    setBusy(true);
    setJoinError(null);
    try {
      const { poolId } = await api.join(code);
      navigate(`/pools/${poolId}`);
    } catch (err) {
      setJoinError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-card card join-card">
      <div className="big-emoji" aria-hidden="true">
        {t?.icon ?? '🏆'}
      </div>
      <p className="muted">{data.pool.ownerName} invited you to</p>
      <h1>{data.pool.name}</h1>
      <p className="muted">
        {t?.name}
        {data.pool.season && ` · ${data.pool.season}`} · {data.pool.memberCount} {data.pool.memberCount === 1 ? 'member' : 'members'}
      </p>
      <StatusPill status={data.pool.status} />
      {user ? (
        <>
          <ErrorBox error={joinError} />
          <button className="btn accent large block" onClick={join} disabled={busy}>
            {busy ? 'Joining…' : 'Join pool'}
          </button>
        </>
      ) : (
        <div className="stack">
          <Link className="btn accent large block" to={`/signup?next=${encodeURIComponent(here)}`}>
            Sign up to join
          </Link>
          <Link className="btn ghost block" to={`/login?next=${encodeURIComponent(here)}`}>
            I already have an account
          </Link>
        </div>
      )}
    </div>
  );
}
