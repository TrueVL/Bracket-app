import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { eliminatedSet, gameOptions, getSlot, participants, pickStatus, type PickStatus } from '../../shared/bracket';
import { layoutBracket } from '../../shared/layout';
import { groupName } from '../../shared/templates';
import type { Field, MatchDef, Picks, Source, Template } from '../../shared/types';
import { useMediaQuery } from '../hooks';
import { TeamBadge } from './Team';

export type BracketMode = 'pick' | 'results' | 'view';

export interface BracketProps {
  template: Template;
  field: Field;
  /** Picks to display (the actual results when mode = 'results'). */
  picks: Picks;
  /** Actual results, used to grade picks in view/pick mode. */
  results?: Picks;
  mode: BracketMode;
  /** Show / edit series scores (e.g. 4–2) for best-of-N rounds. */
  showGames?: boolean;
  onPick?: (matchId: string, slotId: string) => void;
  /** Pick a series result in one go: the winner and how many games it took (null clears the score). */
  onSeries?: (matchId: string, slotId: string, games: number | null) => void;
}

interface Ctx extends BracketProps {
  eliminated: Set<string>;
  statusOf: (matchId: string) => PickStatus | null;
}

function hint(t: Template, src: Source): string {
  if ('seed' in src) return 'TBD';
  if ('rank' in src) return ['Top seed left', 'Next seed left', 'Lowest seed left'][src.rank.index] ?? 'TBD';
  const m = t.matches.find((x) => x.id === src.winner);
  return m ? `${t.rounds[m.round].short} winner` : 'TBD';
}

function TeamRow({ ctx, match, slotId, src }: { ctx: Ctx; match: MatchDef; slotId: string | null; src: Source }) {
  const { template: t, field, picks, mode, onPick } = ctx;
  const team = slotId ? field.teams[slotId] : undefined;
  const slot = slotId ? getSlot(t, slotId) : undefined;
  const winner = picks.winners[match.id];
  const picked = Boolean(slotId) && winner === slotId;
  const interactive = mode !== 'view' && Boolean(slotId) && Boolean(onPick);
  const out = mode !== 'results' && slotId !== null && ctx.eliminated.has(slotId);
  const status = picked && mode !== 'results' ? ctx.statusOf(match.id) : null;

  const cls = [
    'team-row',
    picked && 'picked',
    winner && !picked && slotId && 'lost',
    out && 'out',
    status && `status-${status}`,
    !slotId && 'tbd',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="seed">{slot?.label ?? ''}</span>
      {slotId ? <TeamBadge team={team} size="sm" /> : <span className="badge badge-sm badge-empty" />}
      <span className="name">{slotId ? (team?.short ?? '—') : hint(t, src)}</span>
      {status === 'correct' && <span className="mark ok" aria-label="Correct">✓</span>}
      {status === 'wrong' && <span className="mark bad" aria-label="Wrong">✗</span>}
    </>
  );

  if (!interactive) return <div className={cls}>{content}</div>;
  return (
    <button
      type="button"
      className={cls}
      aria-pressed={picked}
      title={team ? `Pick ${team.name}` : undefined}
      onClick={() => onPick!(match.id, slotId!)}
    >
      {content}
    </button>
  );
}

/** "4–2": the winner's wins, then the loser's, for a series that took `games` games. */
export function seriesScore(bestOf: number, games: number): string {
  const need = Math.ceil(bestOf / 2);
  return `${need}–${games - need}`;
}

/**
 * One row of score buttons per team, e.g. for a best-of-3:
 *   NYY [2–0] [2–1]
 *   BOS [2–0] [2–1]
 * A tap picks the winner and the series score together.
 */
function SeriesPicker({ ctx, match, a, b }: { ctx: Ctx; match: MatchDef; a: string; b: string }) {
  const { template: t, picks, field, onSeries } = ctx;
  const bestOf = t.rounds[match.round].bestOf;
  const winner = picks.winners[match.id];
  const games = picks.games[match.id];
  return (
    <div className="series" role="group" aria-label="Series score">
      {[a, b].map((slot) => {
        const team = field.teams[slot];
        return (
          <div key={slot} className="series-row">
            <TeamBadge team={team} size="sm" />
            {gameOptions(bestOf).map((g) => {
              const on = winner === slot && games === g;
              const score = seriesScore(bestOf, g);
              return (
                <button
                  key={g}
                  type="button"
                  className={on ? 'on' : ''}
                  aria-pressed={on}
                  aria-label={`${team?.short ?? 'Team'} win ${score}`}
                  title={`${team?.short ?? 'Team'} win ${score}`}
                  onClick={() => onSeries!(match.id, slot, on ? null : g)}
                >
                  {score}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function MatchCard({ ctx, match, caption }: { ctx: Ctx; match: MatchDef; caption?: string }) {
  const { template: t, picks, results, mode, showGames, onSeries, field } = ctx;
  const [a, b] = participants(t, match, picks.winners);
  const bestOf = t.rounds[match.round].bestOf;
  const isSeries = Boolean(showGames) && bestOf > 1;
  const winner = picks.winners[match.id];
  const games = picks.games[match.id];
  const actual = mode !== 'results' ? results?.winners[match.id] : undefined;
  const actualGames = mode !== 'results' ? results?.games[match.id] : undefined;
  const status = mode !== 'results' ? ctx.statusOf(match.id) : null;

  return (
    <div className={`match${winner ? ' decided' : ''}`}>
      {caption && <div className="match-caption">{caption}</div>}
      <TeamRow ctx={ctx} match={match} slotId={a} src={match.a} />
      <TeamRow ctx={ctx} match={match} slotId={b} src={match.b} />
      {isSeries && mode !== 'view' && onSeries && a && b && <SeriesPicker ctx={ctx} match={match} a={a} b={b} />}
      {isSeries && mode === 'view' && winner && games !== undefined && (
        <div className="games-note">
          Picked <TeamBadge team={field.teams[winner]} size="sm" /> {seriesScore(bestOf, games)}
        </div>
      )}
      {actual && status === 'wrong' && actual !== winner && (
        <div className="actual-note">
          Won by <TeamBadge team={field.teams[actual]} size="sm" /> {field.teams[actual]?.short}
          {isSeries && actualGames !== undefined && ` ${seriesScore(bestOf, actualGames)}`}
        </div>
      )}
    </div>
  );
}

/** Label the last match of each conference / region. */
function captions(t: Template, field: Field): Map<string, string> {
  const out = new Map<string, string>();
  const groups = new Set(t.matches.map((m) => m.group).filter(Boolean) as string[]);
  for (const g of groups) {
    const ms = t.matches.filter((m) => m.group === g);
    const last = ms.reduce((x, y) => (y.round > x.round ? y : x));
    out.set(last.id, groupName(t, g, field.groupNames));
  }
  return out;
}

function TreeView({ ctx }: { ctx: Ctx }) {
  const t = ctx.template;
  const layout = layoutBracket(t);
  const dense = Boolean(t.compact);
  const series = Boolean(ctx.showGames) && t.rounds.some((r) => r.bestOf > 1);
  const pickers = series && ctx.mode !== 'view';
  const cardW = dense ? 148 : 168;
  const colW = dense ? 166 : 190;
  const rowH = dense ? 60 : pickers ? 132 : series ? 96 : 82;
  const head = 34;
  const width = (layout.cols - 1) * colW + cardW;
  const cy = (id: string) => head + (layout.pos[id].y + 0.5) * rowH;
  const champTop = cy(t.finalId) + (dense ? 44 : 64);
  const height = Math.max(layout.rows * rowH + head + 24, champTop + 110);
  const labels = captions(t, ctx.field);
  const champ = ctx.picks.winners[t.finalId];
  const finalPos = layout.pos[t.finalId];

  return (
    <div className={`tree${dense ? ' dense' : ''}`} style={{ width, height }}>
      {layout.colRounds.map((r, c) => (
        <div key={c} className="col-head" style={{ left: c * colW, width: cardW }}>
          {t.rounds[r].short}
        </div>
      ))}
      <svg className="lines" width={width} height={height} aria-hidden="true">
        {layout.connectors.map(({ from, to }) => {
          const f = layout.pos[from];
          const p = layout.pos[to];
          const rightward = f.col < p.col;
          const x1 = rightward ? f.col * colW + cardW : f.col * colW;
          const x2 = rightward ? p.col * colW : p.col * colW + cardW;
          const mid = (x1 + x2) / 2;
          const on = Boolean(ctx.picks.winners[from]);
          return (
            <path
              key={`${from}-${to}`}
              className={on ? 'on' : ''}
              d={`M${x1} ${cy(from)} H${mid} V${cy(to)} H${x2}`}
            />
          );
        })}
      </svg>
      {t.matches.map((m) => {
        const p = layout.pos[m.id];
        const style: CSSProperties = { left: p.col * colW, top: cy(m.id), width: cardW };
        return (
          <div key={m.id} className="slot" style={style}>
            <MatchCard ctx={ctx} match={m} caption={labels.get(m.id)} />
          </div>
        );
      })}
      <div
        className={`champion${champ ? ' has' : ''}`}
        style={{ left: finalPos.col * colW - 20, width: cardW + 40, top: champTop }}
      >
        <div className="trophy" aria-hidden="true">🏆</div>
        {champ ? (
          <>
            <TeamBadge team={ctx.field.teams[champ]} size="lg" />
            <strong>{ctx.field.teams[champ]?.name}</strong>
          </>
        ) : (
          <span className="muted">{ctx.mode === 'results' ? 'Champion TBD' : 'Pick a champion'}</span>
        )}
      </div>
    </div>
  );
}

function ListView({ ctx }: { ctx: Ctx }) {
  const t = ctx.template;
  const [round, setRound] = useState(() => {
    // Viewing a bracket: jump to the round being played. Otherwise: the next round to pick.
    const decided = ctx.mode === 'view' ? ctx.results?.winners : ctx.picks.winners;
    return t.matches.find((m) => !decided?.[m.id])?.round ?? 0;
  });
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabs.current?.querySelector<HTMLElement>('.on');
    if (el && tabs.current) tabs.current.scrollLeft = Math.max(0, el.offsetLeft - 16);
  }, [round]);
  const matches = t.matches.filter((m) => m.round === round);
  const groups = [...new Set(matches.map((m) => m.group ?? ''))];
  const labels = captions(t, ctx.field);

  return (
    <div className="list-view">
      <div className="round-tabs" role="tablist" ref={tabs}>
        {t.rounds.map((r, i) => {
          const ms = t.matches.filter((m) => m.round === i);
          const done = ms.filter((m) => ctx.picks.winners[m.id]).length;
          return (
            <button key={i} role="tab" aria-selected={i === round} className={i === round ? 'on' : ''} onClick={() => setRound(i)}>
              {r.short}
              <small>
                {done}/{ms.length}
              </small>
            </button>
          );
        })}
      </div>
      {groups.map((g) => (
        <section key={g} className="list-group">
          {g && <h4>{groupName(t, g, ctx.field.groupNames)}</h4>}
          <div className="list-matches">
            {matches
              .filter((m) => (m.group ?? '') === g)
              .map((m) => (
                <MatchCard key={m.id} ctx={ctx} match={m} caption={g ? undefined : labels.get(m.id)} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function Bracket(props: BracketProps) {
  const narrow = useMediaQuery('(max-width: 760px)');
  const [view, setView] = useState<'tree' | 'list' | null>(null);
  const shown = view ?? (narrow ? 'list' : 'tree');

  const results = props.results;
  const eliminated = useMemo(
    () => (results ? eliminatedSet(props.template, results) : new Set<string>()),
    [props.template, results],
  );
  const ctx: Ctx = {
    ...props,
    eliminated,
    statusOf: (id) => (results ? pickStatus(props.template, props.picks, results, id) : null),
  };

  return (
    <div className="bracket">
      <div className="bracket-toolbar">
        <div className="seg" role="group" aria-label="Bracket layout">
          <button type="button" className={shown === 'tree' ? 'on' : ''} onClick={() => setView('tree')}>
            Bracket
          </button>
          <button type="button" className={shown === 'list' ? 'on' : ''} onClick={() => setView('list')}>
            By round
          </button>
        </div>
      </div>
      {shown === 'tree' ? (
        <div className="tree-scroll">
          <TreeView ctx={ctx} />
        </div>
      ) : (
        <ListView ctx={ctx} />
      )}
    </div>
  );
}
