import type { MatchDef, Template } from './types';

export interface MatchPos {
  col: number;
  /** Vertical centre in row units. */
  y: number;
}

export interface Connector {
  from: string;
  to: string;
}

export interface Layout {
  cols: number;
  rows: number;
  pos: Record<string, MatchPos>;
  connectors: Connector[];
  /** Round index shown in each column. */
  colRounds: number[];
}

const cache = new WeakMap<Template, Layout>();

/**
 * Position every match for the classic two-sided bracket: the left side
 * flows right, the right side flows left and the final sits in the middle.
 * Leaf matches are stacked in order; every other match sits halfway
 * between the matches that feed it.
 */
export function layoutBracket(t: Template): Layout {
  const hit = cache.get(t);
  if (hit) return hit;

  const byId = new Map(t.matches.map((m) => [m.id, m]));
  const finalRound = t.rounds.length - 1;
  const cols = finalRound * 2 + 1;
  const feeders = (m: MatchDef) =>
    [m.a, m.b].flatMap((s) => ('winner' in s ? [s.winner] : [])).filter((id) => byId.has(id));

  const pos: Record<string, MatchPos> = {};
  const connectors: Connector[] = [];
  let rows = 0;

  for (const side of ['L', 'R'] as const) {
    const sideMatches = t.matches.filter((m) => m.side === side);
    const fed = new Set(sideMatches.flatMap(feeders));
    const roots = sideMatches.filter((m) => !fed.has(m.id));
    let next = 0;
    const place = (m: MatchDef): number => {
      if (pos[m.id]) return pos[m.id].y;
      const kids = feeders(m)
        .map((id) => byId.get(id)!)
        .filter((k) => k.side === side);
      const ys = kids.map(place);
      for (const k of kids) connectors.push({ from: k.id, to: m.id });
      let y: number;
      if (m.y !== undefined) y = m.y;
      else if (ys.length) y = ys.reduce((a, b) => a + b, 0) / ys.length;
      else y = next++;
      next = Math.max(next, Math.floor(y) + 1);
      pos[m.id] = { col: side === 'L' ? m.round : cols - 1 - m.round, y };
      return y;
    };
    // Matches placed via explicit y may not be reachable from a root (re-seeding).
    for (const r of roots) place(r);
    for (const m of sideMatches) place(m);
    rows = Math.max(rows, ...sideMatches.map((m) => pos[m.id].y + 1), 0);
  }

  for (const m of t.matches.filter((x) => x.side === 'C')) {
    const kids = feeders(m).filter((id) => pos[id]);
    for (const k of kids) connectors.push({ from: k, to: m.id });
    const y = kids.length ? kids.reduce((a, k) => a + pos[k].y, 0) / kids.length : (rows - 1) / 2;
    pos[m.id] = { col: finalRound, y };
    rows = Math.max(rows, y + 1);
  }

  const colRounds = Array.from({ length: cols }, (_, c) => (c <= finalRound ? c : cols - 1 - c));
  const layout = { cols, rows: Math.ceil(rows), pos, connectors, colRounds };
  cache.set(t, layout);
  return layout;
}
