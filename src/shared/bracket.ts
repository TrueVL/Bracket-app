import type { Field, MatchDef, Picks, Scoring, Slot, Source, Template } from './types';

interface Index {
  matches: Map<string, MatchDef>;
  slots: Map<string, Slot>;
}

const cache = new WeakMap<Template, Index>();

function index(t: Template): Index {
  let idx = cache.get(t);
  if (!idx) {
    idx = {
      matches: new Map(t.matches.map((m) => [m.id, m])),
      slots: new Map(t.slots.map((s) => [s.id, s])),
    };
    cache.set(t, idx);
  }
  return idx;
}

export function getMatch(t: Template, id: string): MatchDef | undefined {
  return index(t).matches.get(id);
}

export function getSlot(t: Template, id: string): Slot | undefined {
  return index(t).slots.get(id);
}

function bySeed(t: Template) {
  return (x: string, y: string) => (getSlot(t, x)?.seed ?? 99) - (getSlot(t, y)?.seed ?? 99) || x.localeCompare(y);
}

/** Resolve a source to a slot id, or null when it depends on an undecided match. */
export function resolveSource(t: Template, src: Source, winners: Record<string, string>): string | null {
  if ('seed' in src) return src.seed;
  if ('winner' in src) return winners[src.winner] ?? null;
  const pool = src.rank.of.map((id) => winners[id] ?? null);
  if (pool.some((x) => x === null)) return null;
  return (pool as string[]).sort(bySeed(t))[src.rank.index] ?? null;
}

export function participants(t: Template, m: MatchDef, winners: Record<string, string>): [string | null, string | null] {
  return [resolveSource(t, m.a, winners), resolveSource(t, m.b, winners)];
}

/** Valid series lengths for a best-of-N series, e.g. 7 -> [4,5,6,7]. */
export function gameOptions(bestOf: number): number[] {
  if (bestOf <= 1) return [];
  const min = Math.ceil(bestOf / 2);
  return Array.from({ length: bestOf - min + 1 }, (_, i) => min + i);
}

/**
 * Drop any pick that is no longer possible (e.g. after changing an earlier
 * round) and anything that doesn't belong to this template.
 */
export function sanitize(t: Template, input: Partial<Picks> | null | undefined): Picks {
  const out: Picks = { winners: {}, games: {} };
  const winners = input?.winners ?? {};
  const games = input?.games ?? {};
  for (const m of t.matches) {
    const pick = winners[m.id];
    if (typeof pick !== 'string') continue;
    const [a, b] = participants(t, m, out.winners);
    if (!a || !b || (pick !== a && pick !== b)) continue;
    out.winners[m.id] = pick;
    const g = games[m.id];
    if (typeof g === 'number' && gameOptions(t.rounds[m.round].bestOf).includes(g)) out.games[m.id] = g;
  }
  return out;
}

/** Set a winner for a match and drop anything downstream that no longer fits. */
export function applyPick(t: Template, picks: Picks, matchId: string, slotId: string): Picks {
  return sanitize(t, { winners: { ...picks.winners, [matchId]: slotId }, games: picks.games });
}

export function applyGames(t: Template, picks: Picks, matchId: string, games: number | null): Picks {
  const next = { ...picks.games };
  if (games === null) delete next[matchId];
  else next[matchId] = games;
  return sanitize(t, { winners: picks.winners, games: next });
}

export function clearPick(t: Template, picks: Picks, matchId: string): Picks {
  const winners = { ...picks.winners };
  delete winners[matchId];
  return sanitize(t, { winners, games: picks.games });
}

export function pickCount(t: Template, picks: Picks): number {
  return t.matches.filter((m) => picks.winners[m.id]).length;
}

export function isComplete(t: Template, picks: Picks): boolean {
  return pickCount(t, picks) === t.matches.length;
}

export function champion(t: Template, picks: Picks): string | null {
  return picks.winners[t.finalId] ?? null;
}

export function loserOf(t: Template, m: MatchDef, winners: Record<string, string>): string | null {
  const w = winners[m.id];
  if (!w) return null;
  const [a, b] = participants(t, m, winners);
  return w === a ? b : a;
}

/** Teams knocked out according to the results. */
export function eliminatedSet(t: Template, results: Picks): Set<string> {
  const out = new Set<string>();
  for (const m of t.matches) {
    const l = loserOf(t, m, results.winners);
    if (l) out.add(l);
  }
  return out;
}

/** Winners of each round according to picks/results, by round index. */
function winnersByRound(t: Template, winners: Record<string, string>): Set<string>[] {
  const sets = t.rounds.map(() => new Set<string>());
  for (const m of t.matches) {
    const w = winners[m.id];
    if (w) sets[m.round].add(w);
  }
  return sets;
}

export type PickStatus = 'correct' | 'wrong' | 'pending';

/**
 * Grade a single pick. A pick counts when that team really won a game in
 * that round — comparing by round (not by match) keeps re-seeded brackets fair.
 */
export function pickStatus(t: Template, picks: Picks, results: Picks, matchId: string): PickStatus | null {
  const m = getMatch(t, matchId);
  const p = picks.winners[matchId];
  if (!m || !p) return null;
  const actual = winnersByRound(t, results.winners)[m.round];
  if (actual.has(p)) return 'correct';
  if (eliminatedSet(t, results).has(p)) return 'wrong';
  const roundDone = t.matches.filter((x) => x.round === m.round).every((x) => results.winners[x.id]);
  return roundDone ? 'wrong' : 'pending';
}

export interface Score {
  points: number;
  /** Highest total still reachable. */
  max: number;
  correct: number;
  wrong: number;
  byRound: number[];
}

export function scoreBracket(t: Template, scoring: Scoring, picks: Picks, results: Picks): Score {
  const actual = winnersByRound(t, results.winners);
  const out = new Set(eliminatedSet(t, results));
  const pts = (r: number) => scoring.points[r] ?? t.rounds[r].points;
  const score: Score = { points: 0, max: 0, correct: 0, wrong: 0, byRound: t.rounds.map(() => 0) };
  const roundDone = t.rounds.map((_, r) => t.matches.filter((m) => m.round === r).every((m) => results.winners[m.id]));

  for (const m of t.matches) {
    const p = picks.winners[m.id];
    if (!p) continue;
    const series = t.rounds[m.round].bestOf > 1 && scoring.seriesBonus > 0 && picks.games[m.id] !== undefined;
    if (actual[m.round].has(p)) {
      let gained = pts(m.round);
      // Series-length bonus: only when the pick matches this very series.
      if (series && results.winners[m.id] === p && results.games[m.id] === picks.games[m.id]) gained += scoring.seriesBonus;
      score.points += gained;
      score.byRound[m.round] += gained;
      score.max += gained;
      score.correct++;
      if (series && results.winners[m.id] === p && results.games[m.id] === undefined) score.max += scoring.seriesBonus;
    } else if (out.has(p) || roundDone[m.round]) {
      score.wrong++;
    } else {
      score.max += pts(m.round) + (series ? scoring.seriesBonus : 0);
    }
  }
  return score;
}

export interface RankInput {
  id: string;
  name: string;
  points: number;
  tiebreaker: number | null;
}

/** Sort by points, then closeness to the tiebreaker; equal entries share a rank. */
export function rankEntries<T extends RankInput>(entries: T[], actualTiebreaker: number | null): (T & { rank: number })[] {
  const diff = (e: RankInput) =>
    actualTiebreaker === null || e.tiebreaker === null ? Infinity : Math.abs(e.tiebreaker - actualTiebreaker);
  const sorted = [...entries].sort((x, y) => y.points - x.points || diff(x) - diff(y) || x.name.localeCompare(y.name));
  let rank = 0;
  return sorted.map((e, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.points !== e.points || diff(prev) !== diff(e)) rank = i + 1;
    return { ...e, rank };
  });
}

/** Validate a field: every slot needs a team and teams can't repeat. */
export function fieldProblems(t: Template, field: Field): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const s of t.slots) {
    const team = field.teams[s.id];
    if (!team || !team.name.trim()) {
      problems.push(`${s.desc} has no team yet`);
      continue;
    }
    const key = (team.key ?? team.name).trim().toLowerCase();
    if (seen.has(key)) problems.push(`${team.name} is entered twice`);
    seen.set(key, s.id);
  }
  return problems;
}

export function isFinal(t: Template, results: Picks): boolean {
  return Boolean(results.winners[t.finalId]);
}
