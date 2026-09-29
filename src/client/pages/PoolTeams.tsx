import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PoolDetail } from '../../shared/api';
import { customTeam, eligibleTeams, type LeagueTeam } from '../../shared/teams';
import type { Field, Slot, Team, Template } from '../../shared/types';
import { api } from '../api';
import { TeamBadge } from '../components/Team';
import { ErrorBox, NotFound, Spinner } from '../components/ui';
import { useTitle } from '../hooks';
import { usePool } from '../usePool';
import { PoolHeader } from './Pool';

const CUSTOM = '__custom';

function teamKey(t: Team | undefined): string {
  return t ? (t.key ?? t.name).trim().toLowerCase() : '';
}

function SlotRow({
  slot,
  team,
  template,
  duplicate,
  onChange,
}: {
  slot: Slot;
  team: Team | undefined;
  template: Template;
  duplicate: boolean;
  onChange: (t: Team | undefined) => void;
}) {
  // Only teams that can fill this seed: AL seeds list AL teams, NHL division spots list that division, etc.
  const list = useMemo(() => (template.teamList ? eligibleTeams(template, slot) : null), [template, slot]);
  // "Other" was chosen, or the team was typed in / pasted and isn't from the list.
  const [otherChosen, setOtherChosen] = useState(false);
  const custom = Boolean(list) && (otherChosen || Boolean(team && !team.key));

  // Group the options by division ("AL East", "AL Central", …) when there is more than one.
  const sections = useMemo(() => {
    const byDiv = new Map<string, LeagueTeam[]>();
    for (const t of list ?? []) {
      const label = t.div ? `${t.conf} ${t.div}` : t.conf;
      byDiv.set(label, [...(byDiv.get(label) ?? []), t]);
    }
    return [...byDiv.entries()];
  }, [list]);

  const showText = !list || custom;

  return (
    <div className={`slot-row${duplicate ? ' dup' : ''}`}>
      <span className="seed-chip">{slot.label}</span>
      <div className="slot-main">
        <div className="slot-desc muted small">{slot.desc}</div>
        {list && (
          <select
            value={custom ? CUSTOM : (team?.key ?? '')}
            onChange={(e) => {
              const v = e.target.value;
              if (v === CUSTOM) {
                setOtherChosen(true);
                onChange(undefined);
                return;
              }
              setOtherChosen(false);
              const found = list.find((x) => x.key === v);
              onChange(found ? { key: found.key, name: found.name, short: found.short, abbr: found.abbr, color: found.color } : undefined);
            }}
            aria-label={slot.desc}
          >
            <option value="">Choose a team…</option>
            {sections.length === 1
              ? sections[0][1].map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))
              : sections.map(([label, teams]) => (
                  <optgroup key={label} label={label}>
                    {teams.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
            <option value={CUSTOM}>Other team (type it in)…</option>
          </select>
        )}
        {showText && (
          <div className="custom-team">
            <input
              placeholder="Team name"
              aria-label={`${slot.desc} name`}
              value={team?.name ?? ''}
              maxLength={40}
              onChange={(e) => {
                const name = e.target.value;
                if (!name.trim()) return onChange(undefined);
                const auto = customTeam(name);
                // Keep a hand-edited abbreviation; otherwise follow the name.
                const edited = team && team.abbr !== customTeam(team.name).abbr;
                onChange({ name, short: name, abbr: edited ? team.abbr : auto.abbr, color: team?.color ?? auto.color });
              }}
            />
            <input
              className="abbr-input"
              placeholder="ABBR"
              aria-label={`${slot.desc} abbreviation`}
              value={team?.abbr ?? ''}
              maxLength={5}
              disabled={!team}
              onChange={(e) => team && onChange({ ...team, abbr: e.target.value.toUpperCase() })}
            />
            <input
              type="color"
              aria-label={`${slot.desc} colour`}
              value={team?.color ?? '#334155'}
              disabled={!team}
              onChange={(e) => team && onChange({ ...team, color: e.target.value })}
            />
          </div>
        )}
        {duplicate && <div className="small error-text">This team is already in the bracket.</div>}
      </div>
      <TeamBadge team={team} />
    </div>
  );
}

function PasteBox({ count, onApply }: { count: number; onApply: (names: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open)
    return (
      <button type="button" className="btn small ghost" onClick={() => setOpen(true)}>
        Paste a list
      </button>
    );
  return (
    <div className="paste-box">
      <textarea
        rows={Math.min(count, 10)}
        placeholder={`One team per line, in seed order (${count} lines)`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="row">
        <button
          type="button"
          className="btn small"
          onClick={() => {
            onApply(
              text
                .split('\n')
                .map((l) => l.replace(/^\s*\d+[.)]?\s*/, '').trim())
                .filter(Boolean),
            );
            setOpen(false);
            setText('');
          }}
        >
          Fill seeds
        </button>
        <button type="button" className="btn small ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function TeamsEditor({ pool, template, onSaved }: { pool: PoolDetail; template: Template; onSaved: (p: PoolDetail) => void }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Record<string, Team>>(pool.field.teams);
  const [groupNames, setGroupNames] = useState<Record<string, string>>(pool.field.groupNames ?? {});
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const counts = new Map<string, number>();
  for (const t of Object.values(teams)) counts.set(teamKey(t), (counts.get(teamKey(t)) ?? 0) + 1);
  const filled = template.slots.filter((s) => teams[s.id]).length;

  const set = (slotId: string, t: Team | undefined) => {
    setDirty(true);
    setTeams((prev) => {
      const next = { ...prev };
      if (t) next[slotId] = t;
      else delete next[slotId];
      return next;
    });
  };

  const fillGroup = (slots: Slot[], names: string[]) => {
    setDirty(true);
    setTeams((prev) => {
      const next = { ...prev };
      slots.forEach((s, i) => {
        const n = names[i];
        if (!n) return;
        const lower = n.toLowerCase();
        // Match only teams that can fill this seed; anything else becomes a typed-in team.
        const found = eligibleTeams(template, s).find(
          (t) => t.name.toLowerCase() === lower || t.short.toLowerCase() === lower || t.abbr.toLowerCase() === lower,
        );
        next[s.id] = found ? { key: found.key, name: found.name, short: found.short, abbr: found.abbr, color: found.color } : customTeam(n);
      });
      return next;
    });
  };

  const save = async (andContinue: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const field: Field = { teams, ...(template.renamableGroups ? { groupNames } : {}) };
      const { pool: next } = await api.updatePool(pool.id, { field });
      setDirty(false);
      setProblems(next.fieldProblems);
      onSaved(next);
      if (andContinue && next.fieldProblems.length === 0) navigate(`/pools/${pool.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <p className="muted">
        Put each playoff team in its seed. {template.teamList ? 'Pick from the league list, or type in any team.' : 'Type in the team names.'}{' '}
        {filled}/{template.slots.length} filled.
      </p>
      <div className="groups-grid">
        {template.groups.map((g) => {
          const slots = template.slots.filter((s) => s.group === g.id);
          return (
            <section key={g.id} className="card group-card">
              <div className="card-head">
                {template.renamableGroups ? (
                  <input
                    className="group-name-input"
                    value={groupNames[g.id] ?? g.short}
                    aria-label="Region name"
                    maxLength={24}
                    onChange={(e) => {
                      setDirty(true);
                      setGroupNames({ ...groupNames, [g.id]: e.target.value });
                    }}
                  />
                ) : (
                  <h3>{g.name}</h3>
                )}
                <PasteBox count={slots.length} onApply={(names) => fillGroup(slots, names)} />
              </div>
              {slots.map((s) => (
                <SlotRow
                  key={s.id}
                  slot={s}
                  team={teams[s.id]}
                  template={template}
                  duplicate={Boolean(teams[s.id]) && (counts.get(teamKey(teams[s.id])) ?? 0) > 1}
                  onChange={(t) => set(s.id, t)}
                />
              ))}
            </section>
          );
        })}
      </div>
      <ErrorBox error={error} />
      {problems.length > 0 && !dirty && (
        <div className="alert warn">
          Saved, but a few things still need attention before picks open:
          <ul>
            {problems.slice(0, 6).map((p) => (
              <li key={p}>{p}</li>
            ))}
            {problems.length > 6 && <li>…and {problems.length - 6} more</li>}
          </ul>
        </div>
      )}
      <div className="sticky-actions">
        <span className="muted small">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <button type="button" className="btn" disabled={busy} onClick={() => save(false)}>
          Save
        </button>
        <button type="button" className="btn accent" disabled={busy} onClick={() => save(true)}>
          Save & open for picks
        </button>
      </div>
    </div>
  );
}

export function PoolTeams() {
  const { pool, template, error, loading, setData } = usePool();
  useTitle(pool ? `Teams · ${pool.name}` : 'Teams');
  if (loading && !pool) return <Spinner />;
  if (error && !pool) return <NotFound message="This pool doesn’t exist, or you’re not a member." />;
  if (!pool || !template) return null;

  return (
    <div>
      <PoolHeader pool={pool} template={template} active="teams" />
      {!pool.isOwner ? (
        <ErrorBox error="Only the commissioner can edit the teams." />
      ) : pool.locked ? (
        <div className="alert warn">
          The pool is locked, so teams can’t change anymore. <Link to={`/pools/${pool.id}/results`}>Enter results instead →</Link>
        </div>
      ) : (
        <TeamsEditor key={pool.id} pool={pool} template={template} onSaved={setData} />
      )}
    </div>
  );
}
