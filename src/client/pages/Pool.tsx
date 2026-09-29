import { Link, useNavigate } from 'react-router-dom';
import type { LeaderRow, PoolDetail } from '../../shared/api';
import { eliminatedSet } from '../../shared/bracket';
import type { Template } from '../../shared/types';
import { useAuth } from '../auth';
import { TeamBadge, TeamLabel } from '../components/Team';
import { CopyButton, ErrorBox, formatDate, NotFound, relative, ShareButton, Spinner, StatusPill } from '../components/ui';
import { useTitle } from '../hooks';
import { inviteUrl, usePool } from '../usePool';

export function PoolHeader({ pool, template, active }: { pool: PoolDetail; template: Template; active?: string }) {
  const tabs: [string, string, boolean][] = [
    ['', 'Leaderboard', true],
    ['bracket', 'My bracket', pool.status !== 'setup'],
    ['teams', 'Teams', pool.isOwner],
    ['results', 'Results', pool.isOwner && pool.status !== 'setup'],
    ['settings', 'Settings', true],
  ];
  return (
    <div className="pool-header">
      <div className="pool-title">
        <span className="league-icon big" aria-hidden="true">
          {template.icon}
        </span>
        <div className="grow">
          <h1>{pool.name}</h1>
          <div className="muted">
            {template.name}
            {pool.season && ` · ${pool.season}`} · run by {pool.isOwner ? 'you' : pool.ownerName}
          </div>
        </div>
        <StatusPill status={pool.status} />
      </div>
      <nav className="tabs" aria-label="Pool sections">
        {tabs
          .filter(([, , show]) => show)
          .map(([path, label]) => (
            <Link key={path} to={`/pools/${pool.id}${path ? `/${path}` : ''}`} className={active === path ? 'on' : ''}>
              {label}
            </Link>
          ))}
      </nav>
    </div>
  );
}

function StatusBanner({ pool, template }: { pool: PoolDetail; template: Template }) {
  const decided = Object.keys(pool.results.winners).length;
  const total = template.matches.length;
  const mine = pool.myBracket;
  const myPicks = mine ? Object.keys(mine.picks.winners).length : 0;

  if (pool.status === 'setup') {
    return pool.isOwner ? (
      <div className="banner">
        <div>
          <strong>Next step: add the playoff teams.</strong>
          <p className="muted">Once every seed has a team, your friends can start filling out brackets.</p>
        </div>
        <Link to={`/pools/${pool.id}/teams`} className="btn accent">
          Set up teams →
        </Link>
      </div>
    ) : (
      <div className="banner">
        <div>
          <strong>Almost ready.</strong>
          <p className="muted">{pool.ownerName} is still adding the playoff teams. Check back soon!</p>
        </div>
      </div>
    );
  }

  if (pool.status === 'open') {
    return (
      <div className="banner good">
        <div>
          <strong>{mine ? (myPicks === total ? 'Your bracket is complete ✓' : `You’ve made ${myPicks} of ${total} picks`) : 'Make your picks!'}</strong>
          <p className="muted">
            {pool.lockAt
              ? `Picks lock ${formatDate(pool.lockAt)} (${relative(pool.lockAt)}).`
              : 'No lock time yet — the commissioner will lock picks before the games start.'}{' '}
            Other brackets stay hidden until then.
          </p>
        </div>
        <Link to={`/pools/${pool.id}/bracket`} className="btn accent">
          {mine ? 'Edit my bracket' : 'Fill out my bracket'} →
        </Link>
      </div>
    );
  }

  if (pool.status === 'final') {
    const champ = pool.results.winners[template.finalId];
    const leader = pool.leaderboard.find((r) => r.rank === 1);
    return (
      <div className="banner final">
        <div className="final-row">
          <span className="trophy-big" aria-hidden="true">
            🏆
          </span>
          <div>
            <strong>
              {pool.field.teams[champ]?.name} won it all!
              {leader && ` ${leader.displayName} wins the pool.`}
            </strong>
            <p className="muted">
              Thanks for playing. {pool.tiebreakerActual !== null && `Tiebreaker: ${pool.tiebreakerActual}.`}
            </p>
          </div>
        </div>
        <TeamBadge team={pool.field.teams[champ]} size="lg" />
      </div>
    );
  }

  return (
    <div className="banner warn">
      <div>
        <strong>Picks are locked — let’s go!</strong>
        <p className="muted">
          {decided} of {total} games decided. Tap anyone on the leaderboard to see their bracket.
        </p>
      </div>
      {mine && (
        <Link to={`/brackets/${mine.id}`} className="btn">
          View my bracket
        </Link>
      )}
    </div>
  );
}

function Leaderboard({ pool, template }: { pool: PoolDetail; template: Template }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const before = pool.status === 'open' || pool.status === 'setup';
  const total = template.matches.length;

  const out = eliminatedSet(template, pool.results);
  const open = (r: LeaderRow) => r.visible && r.bracketId && navigate(`/brackets/${r.bracketId}`);

  return (
    <div className="card table-card">
      <div className="card-head">
        <h2>{before ? 'Who’s in' : 'Leaderboard'}</h2>
        <span className="muted small">
          {pool.leaderboard.length} {pool.leaderboard.length === 1 ? 'member' : 'members'}
        </span>
      </div>
      <table className="board">
        <thead>
          <tr>
            {!before && <th className="num">#</th>}
            <th>Player</th>
            {before ? (
              <th>Bracket</th>
            ) : (
              <>
                <th className="hide-sm">Champion</th>
                <th className="num">Pts</th>
                <th className="num" title="Maximum points still possible">
                  Max
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {pool.leaderboard.map((r) => {
            const champ = r.championSlot ? pool.field.teams[r.championSlot] : undefined;
            const champOut = r.championSlot && !before && out.has(r.championSlot);
            return (
              <tr
                key={r.userId}
                className={`${r.userId === user?.id ? 'me' : ''}${r.visible && r.bracketId ? ' clickable' : ''}`}
                onClick={() => open(r)}
                tabIndex={r.visible && r.bracketId ? 0 : undefined}
                onKeyDown={(e) => e.key === 'Enter' && open(r)}
              >
                {!before && <td className="num rank">{r.rank ?? '–'}</td>}
                <td>
                  <div className="player">
                    <span className="avatar" aria-hidden="true">
                      {r.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <div>
                        {r.displayName}
                        {r.isOwner && <span className="tag">commish</span>}
                        {r.userId === user?.id && <span className="tag me-tag">you</span>}
                      </div>
                      {r.bracketName && <div className="muted small">{r.bracketName}</div>}
                    </div>
                  </div>
                </td>
                {before ? (
                  <td>
                    {r.bracketId ? (
                      r.pickCount === total ? (
                        <span className="pill good">Complete</span>
                      ) : (
                        <span className="pill neutral">
                          {r.pickCount}/{total} picks
                        </span>
                      )
                    ) : (
                      <span className="muted small">Not started</span>
                    )}
                  </td>
                ) : (
                  <>
                    <td className={`hide-sm${champOut ? ' out' : ''}`}>{champ ? <TeamLabel team={champ} /> : <span className="muted">—</span>}</td>
                    <td className="num strong">{r.score?.points ?? '–'}</td>
                    <td className="num muted">{r.score?.max ?? '–'}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!before && pool.leaderboard.some((r) => !r.bracketId) && (
        <p className="muted small pad">Members without a bracket are listed at the bottom.</p>
      )}
    </div>
  );
}

function InviteCard({ pool }: { pool: PoolDetail }) {
  const url = inviteUrl(pool.inviteCode);
  return (
    <div className="card invite-card">
      <h3>Invite friends</h3>
      <p className="muted small">Anyone with this link can join the pool.</p>
      <div className="invite-link">
        <code>{url}</code>
      </div>
      <div className="row">
        <CopyButton text={url} label="Copy link" className="btn accent" />
        <ShareButton url={url} title={pool.name} text={`Join my bracket pool "${pool.name}" on Bracket Club!`} />
      </div>
      <p className="muted small">
        Or share the code <strong className="mono">{pool.inviteCode}</strong>
      </p>
    </div>
  );
}

function ScoringCard({ pool, template }: { pool: PoolDetail; template: Template }) {
  return (
    <div className="card">
      <h3>Scoring</h3>
      <ul className="plain-list">
        {template.rounds.map((r, i) => (
          <li key={r.name}>
            <span>{r.name}</span>
            <strong>{pool.scoring.points[i]} pts</strong>
          </li>
        ))}
        {pool.scoring.seriesBonus > 0 && template.rounds.some((r) => r.bestOf > 1) && (
          <li>
            <span>Exact series length</span>
            <strong>+{pool.scoring.seriesBonus}</strong>
          </li>
        )}
      </ul>
      <p className="muted small">Tiebreaker: {template.tiebreaker}.</p>
    </div>
  );
}

export function PoolPage() {
  const { pool, template, error, loading, reload } = usePool();
  useTitle(pool?.name);
  if (loading && !pool) return <Spinner />;
  if (error && !pool) return error.message.includes('not found') ? <NotFound message="This pool doesn’t exist, or you’re not a member." /> : <ErrorBox error={error} retry={reload} />;
  if (!pool || !template) return null;

  return (
    <div className="pool-page">
      <PoolHeader pool={pool} template={template} active="" />
      <StatusBanner pool={pool} template={template} />
      <div className="pool-layout">
        <Leaderboard pool={pool} template={template} />
        <aside className="stack">
          <InviteCard pool={pool} />
          <ScoringCard pool={pool} template={template} />
        </aside>
      </div>
    </div>
  );
}
