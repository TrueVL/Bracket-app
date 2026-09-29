import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTemplate, TEMPLATES } from '../../shared/templates';
import type { Scoring, Template } from '../../shared/types';
import { api } from '../api';
import { defaultScoring, ScoringEditor } from '../components/ScoringEditor';
import { ErrorBox, Field, fromLocalInput } from '../components/ui';
import { useTitle } from '../hooks';

const SPANNING = new Set(['nba', 'nhl', 'ncaam', 'ncaaw', 'nfl', 'cfp']);

function defaultSeason(t: Template): string {
  const now = new Date();
  const y = now.getFullYear();
  if (!SPANNING.has(t.id)) return String(y);
  const start = now.getMonth() >= 5 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const SECTIONS: [Template['category'], string][] = [
  ['pro', 'Pro leagues'],
  ['college', 'College'],
  ['custom', 'Anything else'],
];

export function NewPool() {
  useTitle('New pool');
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [lockAt, setLockAt] = useState('');
  const [scoring, setScoring] = useState<Scoring | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = templateId ? getTemplate(templateId) : undefined;

  const choose = (id: string) => {
    const next = getTemplate(id)!;
    setTemplateId(id);
    const s = defaultSeason(next);
    setSeason(s);
    setName(`${next.name} ${s}`);
    setScoring(defaultScoring(next));
    setTimeout(() => document.getElementById('pool-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!t || !scoring) return;
    setBusy(true);
    setError(null);
    try {
      const { pool } = await api.createPool({ name, templateId: t.id, season, lockAt: fromLocalInput(lockAt), scoring });
      navigate(`/pools/${pool.id}/teams`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="narrow-page">
      <h1>Start a pool</h1>
      <p className="muted">Pick the playoffs you want to bracket. You’ll add the teams next, then invite your friends.</p>

      {SECTIONS.map(([cat, label]) => (
        <section key={cat}>
          <h3 className="section-title small-title">{label}</h3>
          <div className="league-grid">
            {TEMPLATES.filter((x) => x.category === cat).map((x) => (
              <button
                type="button"
                key={x.id}
                className={`league-card card selectable${templateId === x.id ? ' selected' : ''}`}
                onClick={() => choose(x.id)}
                aria-pressed={templateId === x.id}
              >
                <span className="league-icon" aria-hidden="true">
                  {x.icon}
                </span>
                <div>
                  <strong>{x.name}</strong>
                  <p className="muted small">{x.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {t && scoring && (
        <form id="pool-details" className="card stack form-card" onSubmit={submit}>
          <h2>
            {t.icon} {t.name}
          </h2>
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
            hint="Usually the start of the first game. Brackets can’t be changed after this, and everyone’s picks become visible. Leave empty to lock it yourself later."
          >
            <input type="datetime-local" value={lockAt} onChange={(e) => setLockAt(e.target.value)} />
          </Field>
          <div>
            <h3>Scoring</h3>
            <p className="muted small">
              Points for each correct winner. Ties are broken by: <em>{t.tiebreaker.toLowerCase()}</em>.
            </p>
            <ScoringEditor template={t} value={scoring} onChange={setScoring} />
          </div>
          <ErrorBox error={error} />
          <button className="btn accent large" disabled={busy}>
            {busy ? 'Creating…' : 'Create pool & add teams →'}
          </button>
        </form>
      )}
    </div>
  );
}
