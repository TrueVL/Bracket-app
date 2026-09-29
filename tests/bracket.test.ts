import { describe, expect, it } from 'vitest';
import {
  applyPick,
  champion,
  eliminatedSet,
  gameOptions,
  isComplete,
  participants,
  pickStatus,
  rankEntries,
  sanitize,
  scoreBracket,
} from '../src/shared/bracket';
import { layoutBracket } from '../src/shared/layout';
import { eligibleTeams, LEAGUE_TEAMS } from '../src/shared/teams';
import { TEMPLATES, getTemplate, seedOrder } from '../src/shared/templates';
import type { Picks, Template } from '../src/shared/types';

/** Fill a bracket by always taking the better seed (or the 'b' side when `upsets`). */
function fill(t: Template, choose: (a: string, b: string) => string): Picks {
  let picks: Picks = { winners: {}, games: {} };
  for (const m of t.matches) {
    const [a, b] = participants(t, m, picks.winners);
    expect(a, `${t.id} ${m.id} a`).toBeTruthy();
    expect(b, `${t.id} ${m.id} b`).toBeTruthy();
    picks = applyPick(t, picks, m.id, choose(a!, b!));
  }
  return picks;
}

const seedOf = (t: Template, id: string) => t.slots.find((s) => s.id === id)!.seed;

describe('templates', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s is a valid single-elimination bracket', (_id, t) => {
    const ids = new Set<string>();
    for (const m of t.matches) {
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      for (const src of [m.a, m.b]) {
        if ('winner' in src) expect(ids.has(src.winner), `${m.id} refers forward`).toBe(true);
        if ('rank' in src) src.rank.of.forEach((id) => expect(ids.has(id)).toBe(true));
        if ('seed' in src) expect(t.slots.some((s) => s.id === src.seed)).toBe(true);
      }
    }
    // Every slot is used exactly once as a seed source.
    const seeded = t.matches.flatMap((m) => [m.a, m.b]).flatMap((s) => ('seed' in s ? [s.seed] : []));
    expect(seeded.sort()).toEqual(t.slots.map((s) => s.id).sort());
    // n teams need n-1 games.
    expect(t.matches.length).toBe(t.slots.length - 1);
    expect(t.matches[t.matches.length - 1].id).toBe(t.finalId);

    const picks = fill(t, (a, b) => (seedOf(t, a) <= seedOf(t, b) ? a : b));
    expect(isComplete(t, picks)).toBe(true);
    expect(champion(t, picks)).toBeTruthy();

    const layout = layoutBracket(t);
    expect(Object.keys(layout.pos)).toHaveLength(t.matches.length);
    expect(layout.pos[t.finalId].col).toBe((layout.cols - 1) / 2);
  });

  it('has the expected field sizes', () => {
    const sizes = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.slots.length]));
    expect(sizes).toMatchObject({ nfl: 14, nba: 16, nhl: 16, mlb: 12, mls: 18, wnba: 8, cfp: 12, ncaam: 64 });
  });

  it('builds standard seed orders', () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
  });
});

describe('NFL re-seeding', () => {
  const t = getTemplate('nfl')!;

  it('sends the lowest remaining seed to the #1 seed', () => {
    let p: Picks = { winners: {}, games: {} };
    // 7 upsets 2, 3 beats 6, 5 upsets 4 -> remaining 3, 5, 7
    p = applyPick(t, p, 'AFC.0.1', 'AFC7');
    p = applyPick(t, p, 'AFC.0.2', 'AFC3');
    p = applyPick(t, p, 'AFC.0.3', 'AFC5');
    expect(participants(t, t.matches.find((m) => m.id === 'AFC.1.1')!, p.winners)).toEqual(['AFC1', 'AFC7']);
    expect(participants(t, t.matches.find((m) => m.id === 'AFC.1.2')!, p.winners)).toEqual(['AFC3', 'AFC5']);
  });

  it('drops divisional picks that become impossible', () => {
    let p: Picks = { winners: {}, games: {} };
    p = applyPick(t, p, 'AFC.0.1', 'AFC2');
    p = applyPick(t, p, 'AFC.0.2', 'AFC3');
    p = applyPick(t, p, 'AFC.0.3', 'AFC4');
    p = applyPick(t, p, 'AFC.1.1', 'AFC4');
    expect(p.winners['AFC.1.1']).toBe('AFC4');
    // 5 now beats 4, so the #1 seed faces #5 and the "4" pick is gone.
    p = applyPick(t, p, 'AFC.0.3', 'AFC5');
    expect(p.winners['AFC.1.1']).toBeUndefined();
  });
});

describe('sanitize', () => {
  const t = getTemplate('nba')!;
  it('rejects garbage and impossible picks', () => {
    const p = sanitize(t, {
      winners: { 'E.0.1': 'E8', 'E.1.1': 'E5', bogus: 'E1', 'E.0.2': 'W3' },
      games: { 'E.0.1': 3, 'E.0.2': 5 },
    });
    expect(p.winners).toEqual({ 'E.0.1': 'E8' });
    expect(p.games).toEqual({});
  });
  it('keeps valid series lengths', () => {
    expect(gameOptions(7)).toEqual([4, 5, 6, 7]);
    expect(gameOptions(3)).toEqual([2, 3]);
    expect(gameOptions(1)).toEqual([]);
    const p = sanitize(t, { winners: { 'E.0.1': 'E1' }, games: { 'E.0.1': 6 } });
    expect(p.games).toEqual({ 'E.0.1': 6 });
  });
});

describe('scoring', () => {
  const t = getTemplate('nba')!;
  const scoring = { points: [1, 2, 4, 8], seriesBonus: 1 };
  const chalk = fill(t, (a, b) => (seedOf(t, a) <= seedOf(t, b) ? a : b));

  it('scores a perfect bracket', () => {
    const results: Picks = { winners: { ...chalk.winners }, games: {} };
    const s = scoreBracket(t, scoring, chalk, results);
    expect(s.points).toBe(8 * 1 + 4 * 2 + 2 * 4 + 8);
    expect(s.max).toBe(s.points);
    expect(s.correct).toBe(15);
  });

  it('tracks max possible points as teams are knocked out', () => {
    // The East #1 seed loses in round 1; picks that had them go deep are dead.
    const results: Picks = { winners: { 'E.0.1': 'E8' }, games: { 'E.0.1': 7 } };
    const s = scoreBracket(t, scoring, chalk, results);
    expect(s.points).toBe(0);
    expect(s.wrong).toBe(4); // E1 picked in 3 East rounds + the Finals
    expect(s.max).toBe(8 * 1 + 4 * 2 + 2 * 4 + 8 - (1 + 2 + 4 + 8));
    expect(pickStatus(t, chalk, results, 'E.2.1')).toBe('wrong');
    expect(pickStatus(t, chalk, results, 'W.0.1')).toBe('pending');
    expect([...eliminatedSet(t, results)]).toEqual(['E1']);
  });

  it('awards the series-length bonus', () => {
    const picks: Picks = { winners: { ...chalk.winners }, games: { 'E.0.1': 5 } };
    const results: Picks = { winners: { 'E.0.1': 'E1' }, games: { 'E.0.1': 5 } };
    expect(scoreBracket(t, scoring, picks, results).points).toBe(2);
    const wrongLength: Picks = { winners: results.winners, games: { 'E.0.1': 6 } };
    expect(scoreBracket(t, scoring, picks, wrongLength).points).toBe(1);
  });
});

describe('rankEntries', () => {
  it('breaks ties with the tiebreaker and shares ranks', () => {
    const ranked = rankEntries(
      [
        { id: 'a', name: 'Ann', points: 50, tiebreaker: 200 },
        { id: 'b', name: 'Bob', points: 50, tiebreaker: 210 },
        { id: 'c', name: 'Cy', points: 70, tiebreaker: null },
        { id: 'd', name: 'Di', points: 10, tiebreaker: null },
        { id: 'e', name: 'Ed', points: 10, tiebreaker: null },
      ],
      208,
    );
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ['c', 1],
      ['b', 2],
      ['a', 3],
      ['d', 4],
      ['e', 4],
    ]);
  });
});

describe('eligibleTeams', () => {
  const slot = (t: Template, id: string) => t.slots.find((s) => s.id === id)!;

  it('only offers a seed’s own conference', () => {
    const mlb = getTemplate('mlb')!;
    const al = eligibleTeams(mlb, slot(mlb, 'AL1'));
    expect(al).toHaveLength(15);
    expect(al.every((x) => x.conf === 'AL')).toBe(true);
    expect(al.some((x) => x.key === 'NYY')).toBe(true);
    expect(al.some((x) => x.key === 'LAD')).toBe(false);
    const nfc = eligibleTeams(getTemplate('nfl')!, slot(getTemplate('nfl')!, 'NFC3'));
    expect(nfc.every((x) => x.conf === 'NFC')).toBe(true);
    for (const id of ['nba', 'mls']) {
      const t = getTemplate(id)!;
      expect(eligibleTeams(t, slot(t, 'W1')).every((x) => x.conf === 'West')).toBe(true);
    }
  });

  it('limits NHL division spots to that division but not wild cards', () => {
    const nhl = getTemplate('nhl')!;
    const atl2 = eligibleTeams(nhl, slot(nhl, 'EA2'));
    expect(atl2).toHaveLength(8);
    expect(atl2.every((x) => x.div === 'Atlantic')).toBe(true);
    const wc = eligibleTeams(nhl, slot(nhl, 'EAWC'));
    expect(wc).toHaveLength(16);
    expect(wc.every((x) => x.conf === 'East')).toBe(true);
  });

  it('offers every team when there are no conferences', () => {
    const wnba = getTemplate('wnba')!;
    expect(eligibleTeams(wnba, wnba.slots[0])).toHaveLength(LEAGUE_TEAMS.wnba.length);
    expect(eligibleTeams(getTemplate('custom8')!, getTemplate('custom8')!.slots[0])).toEqual([]);
  });
});
