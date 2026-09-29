import { useEffect, useState } from 'react';
import type { PoolDetail } from '../../shared/api';
import { applyGames, applyPick, clearPick, pickCount } from '../../shared/bracket';
import type { Picks, Template } from '../../shared/types';
import { api } from '../api';
import { Bracket } from '../components/Bracket';
import { ErrorBox, Field, NotFound, Spinner } from '../components/ui';
import { useTitle } from '../hooks';
import { usePool } from '../usePool';
import { PoolHeader } from './Pool';

function ResultsEditor({ pool, template, onSaved }: { pool: PoolDetail; template: Template; onSaved: (p: PoolDetail) => void }) {
  const [results, setResults] = useState<Picks>(pool.results);
  const [tiebreaker, setTiebreaker] = useState(pool.tiebreakerActual?.toString() ?? '');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (next: Picks) => {
    setResults(next);
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { pool: next } = await api.saveResults(pool.id, results, tiebreaker === '' ? null : Number(tiebreaker));
      setDirty(false);
      setSavedAt(Date.now());
      onSaved(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decided = pickCount(template, results);

  return (
    <div className="stack">
      {!pool.locked && (
        <div className="alert warn">
          Heads up: picks aren’t locked yet. Lock the pool in Settings before the games start so nobody can change their bracket after
          seeing results.
        </div>
      )}
      <p className="muted">
        Click the winner of each game or series as it finishes. Click a winner again to undo. The leaderboard updates as soon as you save.
      </p>
      <Bracket
        template={template}
        field={pool.field}
        picks={results}
        mode="results"
        showGames={pool.scoring.seriesBonus > 0}
        onPick={(m, s) => change(results.winners[m] === s ? clearPick(template, results, m) : applyPick(template, results, m, s))}
        onGames={(m, g) => change(applyGames(template, results, m, g))}
      />
      <div className="card grid-2 align-end">
        <Field label="Tiebreaker result" hint={template.tiebreaker}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={tiebreaker}
            onChange={(e) => {
              setTiebreaker(e.target.value);
              setDirty(true);
            }}
          />
        </Field>
        <p className="muted small">
          {decided} of {template.matches.length} games decided.
        </p>
      </div>
      <ErrorBox error={error} />
      <div className="sticky-actions">
        <span className="muted small">{dirty ? 'Unsaved changes' : savedAt ? 'Results saved ✓' : 'Up to date'}</span>
        <button type="button" className="btn accent" disabled={busy || !dirty} onClick={save}>
          {busy ? 'Saving…' : 'Save results'}
        </button>
      </div>
    </div>
  );
}

export function PoolResults() {
  const { pool, template, error, loading, setData } = usePool();
  useTitle(pool ? `Results · ${pool.name}` : 'Results');
  if (loading && !pool) return <Spinner />;
  if (error && !pool) return <NotFound message="This pool doesn’t exist, or you’re not a member." />;
  if (!pool || !template) return null;

  return (
    <div>
      <PoolHeader pool={pool} template={template} active="results" />
      {!pool.isOwner ? (
        <ErrorBox error="Only the commissioner can enter results." />
      ) : pool.status === 'setup' ? (
        <ErrorBox error="Add all the teams before entering results." />
      ) : (
        <ResultsEditor key={pool.id} pool={pool} template={template} onSaved={setData} />
      )}
    </div>
  );
}
