import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTemplate, TEMPLATES } from '../../shared/templates';
import { api } from '../api';
import { useAuth } from '../auth';
import { TeamLabel } from '../components/Team';
import { ErrorBox, ordinal, relative, Spinner, StatusPill } from '../components/ui';
import { useAsync, useTitle } from '../hooks';

function Landing() {
  const leagues = TEMPLATES.filter((t) => t.category !== 'custom');
  return (
    <div className="landing">
      <section className="hero">
        <div>
          <h1>
            Playoff brackets
            <br />
            <span className="accent-text">with your crew.</span>
          </h1>
          <p className="lead">
            Build brackets for the NFL, NBA, NHL, MLB, MLS, WNBA, March Madness and the College Football Playoff. Start a pool,
            send the link to your friends, and watch the leaderboard as the games are played.
          </p>
          <div className="row">
            <Link to="/signup" className="btn accent large">
              Start a pool — it’s free
            </Link>
            <Link to="/login" className="btn large ghost">
              I have an account
            </Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="mini-bracket">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="mini-match" style={{ top: 12 + i * 58 }} />
            ))}
            {[0, 1].map((i) => (
              <div key={i} className="mini-match r2" style={{ top: 41 + i * 116 }} />
            ))}
            <div className="mini-match r3" style={{ top: 99 }} />
            <div className="mini-trophy">🏆</div>
          </div>
        </div>
      </section>

      <section className="steps">
        <div className="step card">
          <span className="step-n">1</span>
          <h3>Create a pool</h3>
          <p className="muted">Pick a league, drop the playoff teams into their seeds and choose how picks are scored.</p>
        </div>
        <div className="step card">
          <span className="step-n">2</span>
          <h3>Invite friends</h3>
          <p className="muted">Share one link. Everyone fills out a bracket before the lock time — picks stay hidden until then.</p>
        </div>
        <div className="step card">
          <span className="step-n">3</span>
          <h3>Compete</h3>
          <p className="muted">As winners are entered, the leaderboard updates with points, max possible points and tiebreakers.</p>
        </div>
      </section>

      <section>
        <h2 className="section-title">Every bracket format, built in</h2>
        <div className="league-grid">
          {leagues.map((t) => (
            <div key={t.id} className="league-card card">
              <span className="league-icon" aria-hidden="true">
                {t.icon}
              </span>
              <div>
                <strong>{t.name}</strong>
                <p className="muted small">{t.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function JoinByCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().split('/').pop();
    if (c) navigate(`/join/${encodeURIComponent(c)}`);
  };
  return (
    <form className="join-form" onSubmit={submit}>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code or link" aria-label="Invite code" />
      <button className="btn">Join</button>
    </form>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.pools(), []);

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Hey {user!.displayName} 👋</h1>
          <p className="muted">Your pools and brackets.</p>
        </div>
        <div className="row">
          <JoinByCode />
          <Link to="/pools/new" className="btn accent">
            + New pool
          </Link>
        </div>
      </div>

      {loading && !data && <Spinner />}
      <ErrorBox error={error} retry={reload} />

      {data && data.pools.length === 0 && (
        <div className="empty-state card">
          <div className="big-emoji" aria-hidden="true">🏆</div>
          <h2>No pools yet</h2>
          <p className="muted">Start one for the next playoffs, or ask a friend for their invite link.</p>
          <Link to="/pools/new" className="btn accent">
            Create your first pool
          </Link>
        </div>
      )}

      <div className="pool-grid">
        {data?.pools.map((p) => {
          const t = getTemplate(p.templateId);
          const champ = p.championSlot ? p.field.teams[p.championSlot] : undefined;
          return (
            <Link key={p.id} to={`/pools/${p.id}`} className="pool-card card">
              <div className="pool-card-top">
                <span className="league-icon" aria-hidden="true">
                  {t?.icon}
                </span>
                <div className="grow">
                  <strong>{p.name}</strong>
                  <div className="muted small">
                    {t?.name}
                    {p.season && ` · ${p.season}`}
                  </div>
                </div>
                <StatusPill status={p.status} />
              </div>
              <div className="pool-card-stats">
                <div>
                  <span className="stat">{p.memberCount}</span>
                  <span className="muted small">{p.memberCount === 1 ? 'member' : 'members'}</span>
                </div>
                {p.myRank !== null && p.status !== 'open' && p.status !== 'setup' ? (
                  <div>
                    <span className="stat">{ordinal(p.myRank)}</span>
                    <span className="muted small">{p.myPoints} pts</span>
                  </div>
                ) : (
                  <div>
                    <span className="stat">
                      {p.myPickCount}/{p.totalPicks}
                    </span>
                    <span className="muted small">picks made</span>
                  </div>
                )}
                {champ && (
                  <div className="champ-pick">
                    <span className="muted small">Your champ</span>
                    <TeamLabel team={champ} />
                  </div>
                )}
              </div>
              {p.status === 'open' && p.lockAt && <div className="small muted">Locks {relative(p.lockAt)}</div>}
              {p.status === 'open' && p.myPickCount < p.totalPicks && <div className="nudge">Finish your bracket →</div>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Home() {
  const { user, loading } = useAuth();
  useTitle(undefined);
  if (loading) return <Spinner />;
  return user ? <Dashboard /> : <Landing />;
}
