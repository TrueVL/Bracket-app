import { LEAGUE_TEAMS } from '../shared/teams';
import type { Field, Scoring, Team, Template } from '../shared/types';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const bad = (msg: string) => new HttpError(400, msg);

export function str(v: unknown, name: string, min: number, max: number): string {
  if (typeof v !== 'string') throw bad(`${name} is required.`);
  const s = v.trim();
  if (s.length < min) throw bad(min <= 1 ? `${name} is required.` : `${name} must be at least ${min} characters.`);
  if (s.length > max) throw bad(`${name} must be at most ${max} characters.`);
  return s;
}

export function optionalNumber(v: unknown, name: string): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1_000_000) throw bad(`${name} must be a positive number.`);
  return n;
}

export function lockAt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw bad('Lock time is invalid.');
  return Math.round(v);
}

export function scoring(v: unknown, t: Template): Scoring {
  const defaults: Scoring = { points: t.rounds.map((r) => r.points), seriesBonus: t.rounds.some((r) => r.bestOf > 1) ? 5 : 0 };
  if (v === undefined || v === null) return defaults;
  if (typeof v !== 'object') throw bad('Scoring is invalid.');
  const s = v as Partial<Scoring>;
  const int = (x: unknown, name: string) => {
    if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x > 100_000) throw bad(`${name} must be a whole number from 0 to 100000.`);
    return x;
  };
  const points = Array.isArray(s.points) ? s.points : defaults.points;
  if (points.length !== t.rounds.length) throw bad('Points must be given for every round.');
  return {
    points: points.map((p, i) => int(p, `${t.rounds[i].name} points`)),
    seriesBonus: s.seriesBonus === undefined ? defaults.seriesBonus : int(s.seriesBonus, 'Series bonus'),
  };
}

function team(v: unknown, t: Template): Team | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (t.teamList && typeof o.key === 'string') {
    const found = LEAGUE_TEAMS[t.teamList].find((x) => x.key === o.key);
    if (found) return { key: found.key, name: found.name, short: found.short, abbr: found.abbr, color: found.color };
  }
  if (typeof o.name !== 'string' || !o.name.trim()) return null;
  const name = str(o.name, 'Team name', 1, 40);
  const color = typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : '#334155';
  return {
    name,
    short: typeof o.short === 'string' && o.short.trim() ? str(o.short, 'Short name', 1, 24) : name.slice(0, 24),
    abbr: typeof o.abbr === 'string' && o.abbr.trim() ? str(o.abbr, 'Abbreviation', 1, 5).toUpperCase() : name.slice(0, 3).toUpperCase(),
    color,
  };
}

export function field(v: unknown, t: Template): Field {
  if (!v || typeof v !== 'object') throw bad('Teams are invalid.');
  const input = v as { teams?: Record<string, unknown>; groupNames?: Record<string, unknown> };
  const out: Field = { teams: {} };
  for (const s of t.slots) {
    const tm = team(input.teams?.[s.id], t);
    if (tm) out.teams[s.id] = tm;
  }
  if (t.renamableGroups && input.groupNames && typeof input.groupNames === 'object') {
    out.groupNames = {};
    for (const g of t.groups) {
      const n = input.groupNames[g.id];
      if (typeof n === 'string' && n.trim()) out.groupNames[g.id] = str(n, 'Region name', 1, 24);
    }
  }
  return out;
}
