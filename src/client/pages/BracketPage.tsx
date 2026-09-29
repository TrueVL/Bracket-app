import { Link, useParams } from 'react-router-dom';
import { getTemplate } from '../../shared/templates';
import { api, ApiError } from '../api';
import { Bracket } from '../components/Bracket';
import { TeamLabel } from '../components/Team';
import { CopyButton, ErrorBox, NotFound, ordinal, Spinner, StatusPill } from '../components/ui';
import { useAsync, useTitle } from '../hooks';

export function BracketPage() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.bracket(id), [id]);
  useTitle(data?.bracket.name);

  if (loading && !data) return <Spinner />;
  if (error && !data) {
    if (error instanceof ApiError && error.status === 403)
      return (
        <div className="empty-state">
          <div className="big-emoji" aria-hidden="true">🙈</div>
          <h2>No peeking yet</h2>
          <p className="muted">{error.message}</p>
          <Link className="btn" to="/">
            Back home
          </Link>
        </div>
      );
    if (error instanceof ApiError && error.status === 404) return <NotFound message="That bracket doesn’t exist." />;
    return <ErrorBox error={error} retry={reload} />;
  }
  if (!data) return null;

  const t = getTemplate(data.pool.templateId);
  if (!t) return <NotFound />;
  const { bracket, score, pool } = data;
  const champ = bracket.picks.winners[t.finalId];
  const started = Object.keys(pool.results.winners).length > 0;

  return (
    <div className="stack">
      <div className="bracket-head">
        <div className="grow">
          <div className="muted small">
            {data.isMember ? <Link to={`/pools/${pool.id}`}>← {pool.name}</Link> : pool.name} · {t.name}
            {pool.season && ` ${pool.season}`}
          </div>
          <h1>{bracket.name}</h1>
          <div className="muted">by {bracket.ownerName}</div>
        </div>
        <StatusPill status={pool.status} />
      </div>

      <div className="stat-row">
        <div className="stat-card card">
          <span className="muted small">Rank</span>
          <strong>{data.rank && started ? ordinal(data.rank) : '–'}</strong>
          <span className="muted small">of {data.entries}</span>
        </div>
        <div className="stat-card card">
          <span className="muted small">Points</span>
          <strong>{score.points}</strong>
          <span className="muted small">max {score.max}</span>
        </div>
        <div className="stat-card card">
          <span className="muted small">Correct</span>
          <strong>
            {score.correct}
            <span className="muted">/{score.correct + score.wrong || 0}</span>
          </strong>
          <span className="muted small">decided picks</span>
        </div>
        <div className="stat-card card">
          <span className="muted small">Champion</span>
          <strong className="champ-stat">{champ ? <TeamLabel team={pool.field.teams[champ]} /> : '—'}</strong>
          <span className="muted small">
            Tiebreaker: {bracket.tiebreaker ?? '—'}
            {pool.tiebreakerActual !== null && ` (actual ${pool.tiebreakerActual})`}
          </span>
        </div>
      </div>

      <div className="row wrap-row">
        {data.isMine && !pool.locked && (
          <Link className="btn accent" to={`/pools/${pool.id}/bracket`}>
            Edit my picks
          </Link>
        )}
        <CopyButton text={window.location.href} label="Copy link to this bracket" />
        {data.isMine && !pool.locked && <span className="muted small">Friends can open this link once picks lock.</span>}
      </div>

      <Bracket
        template={t}
        field={pool.field}
        picks={bracket.picks}
        results={pool.results}
        mode="view"
        showGames={pool.scoring.seriesBonus > 0}
      />
      <p className="muted small legend">
        <span className="legend-item ok">✓ correct</span>
        <span className="legend-item bad">✗ wrong</span>
        <span className="legend-item out">eliminated</span>
      </p>
    </div>
  );
}
