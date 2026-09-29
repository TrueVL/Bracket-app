import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { PoolDetail } from '../../shared/api';
import { applyGames, applyPick, getSlot, participants, pickCount, sanitize } from '../../shared/bracket';
import { emptyPicks, type Picks, type Template } from '../../shared/types';
import { api } from '../api';
import { useAuth } from '../auth';
import { Bracket } from '../components/Bracket';
import { ErrorBox, Field, formatDate, NotFound, relative, Spinner } from '../components/ui';
import { useTitle } from '../hooks';
import { usePool } from '../usePool';
import { PoolHeader } from './Pool';

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** Fill every open match, picking with `choose`. */
function autofill(t: Template, picks: Picks, choose: (a: string, b: string) => string): Picks {
  let next = picks;
  for (const m of t.matches) {
    if (next.winners[m.id]) continue;
    const [a, b] = participants(t, m, next.winners);
    if (a && b) next = applyPick(t, next, m.id, choose(a, b));
  }
  return next;
}

function Editor({ pool, template }: { pool: PoolDetail; template: Template }) {
  const { user } = useAuth();
  const [picks, setPicks] = useState<Picks>(() => sanitize(template, pool.myBracket?.picks ?? emptyPicks()));
  const [name, setName] = useState(pool.myBracket?.name ?? `${user!.displayName}'s bracket`);
  const [tiebreaker, setTiebreaker] = useState(pool.myBracket?.tiebreaker?.toString() ?? '');
  const [state, setState] = useState<SaveState>(pool.myBracket ? 'saved' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [bracketId, setBracketId] = useState(pool.myBracket?.id ?? null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef({ picks, name, tiebreaker });
  latest.current = { picks, name, tiebreaker };

  const save = useCallback(() => {
    queue.current = queue.current.then(async () => {
      setState('saving');
      const { picks: p, name: n, tiebreaker: tb } = latest.current;
      try {
        const { bracket } = await api.saveBracket(pool.id, {
          name: n.trim() || `${user!.displayName}'s bracket`,
          picks: p,
          tiebreaker: tb === '' ? null : Number(tb),
        });
        setBracketId(bracket.id);
        setError(null);
        setState((s) => (s === 'saving' ? 'saved' : s));
      } catch (err) {
        setError((err as Error).message);
        setState('error');
      }
    });
  }, [pool.id, user]);

  // Autosave shortly after each change.
  useEffect(() => {
    if (state !== 'pending') return;
    const h = setTimeout(save, 700);
    return () => clearTimeout(h);
  }, [state, picks, name, tiebreaker, save]);

  useEffect(() => {
    if (state !== 'pending' && state !== 'saving') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  const change = (next: Picks) => {
    setPicks(next);
    setState('pending');
  };

  const done = pickCount(template, picks);
  const total = template.matches.length;
  const seed = (id: string) => getSlot(template, id)?.seed ?? 99;
  const showGames = pool.scoring.seriesBonus > 0 && template.rounds.some((r) => r.bestOf > 1);

  return (
    <div className="stack">
      <div className="editor-bar card">
        <div className="editor-meta">
          <Field label="Bracket name">
            <input
              value={name}
              maxLength={40}
              onChange={(e) => {
                setName(e.target.value);
                setState('pending');
              }}
            />
          </Field>
          <Field label="Tiebreaker" hint={template.tiebreaker}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={tiebreaker}
              placeholder="e.g. 45"
              onChange={(e) => {
                setTiebreaker(e.target.value);
                setState('pending');
              }}
            />
          </Field>
        </div>
        <div className="editor-status">
          <div className="progress" aria-label={`${done} of ${total} picks`}>
            <div className="progress-bar" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <div className="row between">
            <span className="small">
              <strong>
                {done}/{total}
              </strong>{' '}
              picks{done === total && ' — complete! 🎉'}
            </span>
            <span className={`save-state ${state}`}>
              {state === 'saving' || state === 'pending' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : state === 'error' ? 'Not saved' : ''}
            </span>
          </div>
          <div className="row wrap-row">
            <button
              type="button"
              className="btn small ghost"
              onClick={() => change(autofill(template, picks, (a, b) => (seed(a) <= seed(b) ? a : b)))}
            >
              Fill with favorites
            </button>
            <button
              type="button"
              className="btn small ghost"
              onClick={() => change(autofill(template, picks, (a, b) => (Math.random() < 0.5 ? a : b)))}
            >
              Coin-flip the rest
            </button>
            <button
              type="button"
              className="btn small ghost danger"
              disabled={done === 0}
              onClick={() => window.confirm('Clear all your picks?') && change(emptyPicks())}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      <ErrorBox error={error} retry={save} />
      <p className="muted small">
        Click a team to move it on. Changing an early pick clears later picks that depended on it.
        {showGames &&
          ` For a series, tap a score under the teams (like 4–2) to pick the winner and how many games each team wins: +${pool.scoring.seriesBonus} bonus points if you get the exact score.`}
        {pool.lockAt && ` Locks ${formatDate(pool.lockAt)} (${relative(pool.lockAt)}).`}
      </p>
      <Bracket
        template={template}
        field={pool.field}
        picks={picks}
        mode="pick"
        showGames={showGames}
        onPick={(m, s) => change(applyPick(template, picks, m, s))}
        onSeries={(m, s, g) => change(applyGames(template, applyPick(template, picks, m, s), m, g))}
      />
      {bracketId && (
        <p className="muted small center">
          Your bracket link (others can open it once picks lock): <Link to={`/brackets/${bracketId}`}>/brackets/{bracketId}</Link>
        </p>
      )}
    </div>
  );
}

export function PoolBracket() {
  const { pool, template, error, loading } = usePool();
  useTitle(pool ? `My bracket · ${pool.name}` : 'My bracket');
  if (loading && !pool) return <Spinner />;
  if (error && !pool) return <NotFound message="This pool doesn’t exist, or you’re not a member." />;
  if (!pool || !template) return null;
  if (pool.locked && pool.myBracket) return <Navigate to={`/brackets/${pool.myBracket.id}`} replace />;

  return (
    <div>
      <PoolHeader pool={pool} template={template} active="bracket" />
      {pool.status === 'setup' ? (
        <div className="alert">The commissioner is still adding teams. You can fill out your bracket once they’re done.</div>
      ) : pool.locked ? (
        <ErrorBox error="Picks are locked and you didn’t submit a bracket for this pool." />
      ) : (
        <Editor key={pool.id} pool={pool} template={template} />
      )}
    </div>
  );
}
