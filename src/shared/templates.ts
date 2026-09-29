import type { MatchDef, Round, Side, Slot, Source, Template } from './types';

const seed = (id: string): Source => ({ seed: id });
const win = (id: string): Source => ({ winner: id });

/**
 * Build a fixed (non re-seeding) single elimination sub-bracket.
 * `entrants` are listed in display order; neighbours play each other.
 * Returns the matches plus the id of the sub-bracket's last match.
 */
function elim(prefix: string, side: Side, startRound: number, entrants: Source[], group?: string) {
  const matches: MatchDef[] = [];
  let current = entrants;
  let round = startRound;
  while (current.length > 1) {
    const next: Source[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const id = `${prefix}.${round}.${i / 2 + 1}`;
      matches.push({ id, round, side, group, a: current[i], b: current[i + 1] });
      next.push(win(id));
    }
    current = next;
    round++;
  }
  const last = matches[matches.length - 1];
  return { matches, last: last.id };
}

function seededSlots(group: string, count: number, desc: (s: number) => string, prefix = group): Slot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    group,
    seed: i + 1,
    label: String(i + 1),
    desc: desc(i + 1),
  }));
}

function rounds(defs: [name: string, short: string, bestOf: number][], points: number[]): Round[] {
  return defs.map(([name, short, bestOf], i) => ({ name, short, bestOf, points: points[i] }));
}

function byRound(matches: MatchDef[]): MatchDef[] {
  return [...matches].sort((x, y) => x.round - y.round);
}

// ---------------------------------------------------------------- NFL

function nfl(): Template {
  const confs: [string, Side][] = [
    ['AFC', 'L'],
    ['NFC', 'R'],
  ];
  const slots: Slot[] = [];
  const matches: MatchDef[] = [];
  for (const [c, side] of confs) {
    slots.push(...seededSlots(c, 7, (s) => `${c} #${s} seed${s === 1 ? ' (first-round bye)' : ''}`));
    const wc = [
      [2, 7],
      [3, 6],
      [4, 5],
    ].map(([hi, lo], i) => {
      const id = `${c}.0.${i + 1}`;
      matches.push({ id, round: 0, side, group: c, a: seed(`${c}${hi}`), b: seed(`${c}${lo}`), y: i + 1 });
      return id;
    });
    // Divisional round re-seeds: #1 hosts the lowest remaining seed.
    matches.push({ id: `${c}.1.1`, round: 1, side, group: c, a: seed(`${c}1`), b: { rank: { of: wc, index: 2 } }, y: 0.5 });
    matches.push({
      id: `${c}.1.2`,
      round: 1,
      side,
      group: c,
      a: { rank: { of: wc, index: 0 } },
      b: { rank: { of: wc, index: 1 } },
      y: 2.5,
    });
    matches.push({ id: `${c}.2.1`, round: 2, side, group: c, a: win(`${c}.1.1`), b: win(`${c}.1.2`) });
  }
  matches.push({ id: 'SB', round: 3, side: 'C', a: win('AFC.2.1'), b: win('NFC.2.1') });
  return {
    id: 'nfl',
    league: 'NFL',
    name: 'NFL Playoffs',
    icon: '🏈',
    category: 'pro',
    description: '14 teams · Wild Card, Divisional (re-seeded), Conference Championships, Super Bowl',
    teamList: 'nfl',
    groups: [
      { id: 'AFC', name: 'American Football Conference', short: 'AFC' },
      { id: 'NFC', name: 'National Football Conference', short: 'NFC' },
    ],
    slots,
    rounds: rounds(
      [
        ['Wild Card Round', 'Wild Card', 1],
        ['Divisional Round', 'Divisional', 1],
        ['Conference Championships', 'Conference', 1],
        ['Super Bowl', 'Super Bowl', 1],
      ],
      [10, 20, 40, 80],
    ),
    matches: byRound(matches),
    finalId: 'SB',
    tiebreaker: 'Total combined points scored in the Super Bowl',
  };
}

// ---------------------------------------------------------------- NBA / WNBA

function nba(): Template {
  const slots: Slot[] = [];
  const matches: MatchDef[] = [];
  const lasts: string[] = [];
  for (const [c, side, name] of [
    ['E', 'L', 'East'],
    ['W', 'R', 'West'],
  ] as [string, Side, string][]) {
    slots.push(...seededSlots(c, 8, (s) => `${name} #${s} seed`));
    const b = elim(c, side, 0, [1, 8, 4, 5, 3, 6, 2, 7].map((s) => seed(`${c}${s}`)), c);
    matches.push(...b.matches);
    lasts.push(b.last);
  }
  matches.push({ id: 'F', round: 3, side: 'C', a: win(lasts[0]), b: win(lasts[1]) });
  return {
    id: 'nba',
    league: 'NBA',
    name: 'NBA Playoffs',
    icon: '🏀',
    category: 'pro',
    description: '16 teams (after the Play-In) · four best-of-seven rounds',
    teamList: 'nba',
    groups: [
      { id: 'E', name: 'Eastern Conference', short: 'East' },
      { id: 'W', name: 'Western Conference', short: 'West' },
    ],
    slots,
    rounds: rounds(
      [
        ['First Round', 'First Round', 7],
        ['Conference Semifinals', 'Conf. Semis', 7],
        ['Conference Finals', 'Conf. Finals', 7],
        ['NBA Finals', 'Finals', 7],
      ],
      [10, 20, 40, 80],
    ),
    matches: byRound(matches),
    finalId: 'F',
    tiebreaker: 'Total combined points in the final game of the NBA Finals',
  };
}

function wnba(): Template {
  const slots = seededSlots('L', 8, (s) => `#${s} seed`, 'S');
  const left = elim('L', 'L', 0, [1, 8, 4, 5].map((s) => seed(`S${s}`)));
  const right = elim('R', 'R', 0, [2, 7, 3, 6].map((s) => seed(`S${s}`)));
  const matches = [...left.matches, ...right.matches, { id: 'F', round: 2, side: 'C' as Side, a: win(left.last), b: win(right.last) }];
  return {
    id: 'wnba',
    league: 'WNBA',
    name: 'WNBA Playoffs',
    icon: '🏀',
    category: 'pro',
    description: '8 teams seeded 1–8 · best-of-3, best-of-5, best-of-7 Finals',
    teamList: 'wnba',
    groups: [{ id: 'L', name: 'League', short: 'WNBA' }],
    slots,
    rounds: rounds(
      [
        ['First Round', 'First Round', 3],
        ['Semifinals', 'Semifinals', 5],
        ['WNBA Finals', 'Finals', 7],
      ],
      [10, 20, 40],
    ),
    matches: byRound(matches),
    finalId: 'F',
    tiebreaker: 'Total combined points in the final game of the WNBA Finals',
  };
}

// ---------------------------------------------------------------- NHL

function nhl(): Template {
  const confs: [string, Side, string, [string, string], [string, string]][] = [
    ['E', 'L', 'East', ['A', 'Atlantic'], ['M', 'Metropolitan']],
    ['W', 'R', 'West', ['C', 'Central'], ['P', 'Pacific']],
  ];
  const slots: Slot[] = [];
  const matches: MatchDef[] = [];
  const lasts: string[] = [];
  for (const [c, side, , d1, d2] of confs) {
    const entrants: Source[] = [];
    [d1, d2].forEach(([d, dname], di) => {
      const div: Slot[] = [
        { id: `${c}${d}1`, group: c, seed: 1 + di, label: `${d}1`, desc: `${dname} Division winner` },
        { id: `${c}${d}WC`, group: c, seed: 7 + di, label: 'WC', desc: `Wild card facing the ${dname} winner` },
        { id: `${c}${d}2`, group: c, seed: 3 + di, label: `${d}2`, desc: `${dname} 2nd place` },
        { id: `${c}${d}3`, group: c, seed: 5 + di, label: `${d}3`, desc: `${dname} 3rd place` },
      ];
      slots.push(...div);
      entrants.push(...div.map((s) => seed(s.id)));
    });
    const b = elim(c, side, 0, entrants, c);
    matches.push(...b.matches);
    lasts.push(b.last);
  }
  matches.push({ id: 'F', round: 3, side: 'C', a: win(lasts[0]), b: win(lasts[1]) });
  return {
    id: 'nhl',
    league: 'NHL',
    name: 'Stanley Cup Playoffs',
    icon: '🏒',
    category: 'pro',
    description: '16 teams · divisional bracket with wild cards · four best-of-seven rounds',
    teamList: 'nhl',
    groups: [
      { id: 'E', name: 'Eastern Conference', short: 'East' },
      { id: 'W', name: 'Western Conference', short: 'West' },
    ],
    slots,
    rounds: rounds(
      [
        ['First Round', 'First Round', 7],
        ['Second Round', 'Second Round', 7],
        ['Conference Finals', 'Conf. Finals', 7],
        ['Stanley Cup Final', 'Cup Final', 7],
      ],
      [10, 20, 40, 80],
    ),
    matches: byRound(matches),
    finalId: 'F',
    tiebreaker: 'Total goals scored in the Stanley Cup Final (all games)',
  };
}

// ---------------------------------------------------------------- MLB

function mlb(): Template {
  const slots: Slot[] = [];
  const matches: MatchDef[] = [];
  for (const [c, side] of [
    ['AL', 'L'],
    ['NL', 'R'],
  ] as [string, Side][]) {
    slots.push(...seededSlots(c, 6, (s) => `${c} #${s} seed${s <= 2 ? ' (bye to the Division Series)' : ''}`));
    matches.push({ id: `${c}.0.1`, round: 0, side, group: c, a: seed(`${c}4`), b: seed(`${c}5`) });
    matches.push({ id: `${c}.0.2`, round: 0, side, group: c, a: seed(`${c}3`), b: seed(`${c}6`) });
    matches.push({ id: `${c}.1.1`, round: 1, side, group: c, a: seed(`${c}1`), b: win(`${c}.0.1`) });
    matches.push({ id: `${c}.1.2`, round: 1, side, group: c, a: seed(`${c}2`), b: win(`${c}.0.2`) });
    matches.push({ id: `${c}.2.1`, round: 2, side, group: c, a: win(`${c}.1.1`), b: win(`${c}.1.2`) });
  }
  matches.push({ id: 'WS', round: 3, side: 'C', a: win('AL.2.1'), b: win('NL.2.1') });
  return {
    id: 'mlb',
    league: 'MLB',
    name: 'MLB Postseason',
    icon: '⚾',
    category: 'pro',
    description: '12 teams · Wild Card Series, Division Series, LCS, World Series',
    teamList: 'mlb',
    groups: [
      { id: 'AL', name: 'American League', short: 'AL' },
      { id: 'NL', name: 'National League', short: 'NL' },
    ],
    slots,
    rounds: rounds(
      [
        ['Wild Card Series', 'Wild Card', 3],
        ['Division Series', 'Division Series', 5],
        ['League Championship Series', 'LCS', 7],
        ['World Series', 'World Series', 7],
      ],
      [10, 20, 40, 80],
    ),
    matches: byRound(matches),
    finalId: 'WS',
    tiebreaker: 'Total runs scored in the World Series (all games)',
  };
}

// ---------------------------------------------------------------- MLS

function mls(): Template {
  const slots: Slot[] = [];
  const matches: MatchDef[] = [];
  const lasts: string[] = [];
  for (const [c, side, name] of [
    ['E', 'L', 'East'],
    ['W', 'R', 'West'],
  ] as [string, Side, string][]) {
    slots.push(...seededSlots(c, 9, (s) => `${name} #${s} seed`));
    const wc = `${c}.0.1`;
    matches.push({ id: wc, round: 0, side, group: c, a: seed(`${c}8`), b: seed(`${c}9`) });
    const entrants = [seed(`${c}1`), win(wc), ...[4, 5, 3, 6, 2, 7].map((s) => seed(`${c}${s}`))];
    const b = elim(c, side, 1, entrants, c);
    matches.push(...b.matches);
    lasts.push(b.last);
  }
  matches.push({ id: 'CUP', round: 4, side: 'C', a: win(lasts[0]), b: win(lasts[1]) });
  return {
    id: 'mls',
    league: 'MLS',
    name: 'MLS Cup Playoffs',
    icon: '⚽',
    category: 'pro',
    description: '18 teams · Wild Card, best-of-3 Round One, single-match rounds to MLS Cup',
    teamList: 'mls',
    groups: [
      { id: 'E', name: 'Eastern Conference', short: 'East' },
      { id: 'W', name: 'Western Conference', short: 'West' },
    ],
    slots,
    rounds: rounds(
      [
        ['Wild Card', 'Wild Card', 1],
        ['Round One', 'Round One', 3],
        ['Conference Semifinals', 'Conf. Semis', 1],
        ['Conference Final', 'Conf. Final', 1],
        ['MLS Cup', 'MLS Cup', 1],
      ],
      [5, 10, 20, 40, 80],
    ),
    matches: byRound(matches),
    finalId: 'CUP',
    tiebreaker: 'Total goals scored in MLS Cup (excluding penalties)',
  };
}

// ---------------------------------------------------------------- College

function cfp(): Template {
  const slots = seededSlots('L', 12, (s) => `#${s} seed${s <= 4 ? ' (first-round bye)' : ''}`, 'S');
  const matches: MatchDef[] = [];
  const halves: [string, Side, [number, number, number][]][] = [
    [
      'L',
      'L',
      [
        [1, 8, 9],
        [4, 5, 12],
      ],
    ],
    [
      'R',
      'R',
      [
        [2, 7, 10],
        [3, 6, 11],
      ],
    ],
  ];
  const lasts: string[] = [];
  for (const [p, side, pods] of halves) {
    const entrants: Source[] = [];
    pods.forEach(([top, hi, lo], i) => {
      const id = `${p}.0.${i + 1}`;
      matches.push({ id, round: 0, side, a: seed(`S${hi}`), b: seed(`S${lo}`) });
      entrants.push(seed(`S${top}`), win(id));
    });
    const b = elim(p, side, 1, entrants);
    matches.push(...b.matches);
    lasts.push(b.last);
  }
  matches.push({ id: 'F', round: 3, side: 'C', a: win(lasts[0]), b: win(lasts[1]) });
  return {
    id: 'cfp',
    league: 'CFP',
    name: 'College Football Playoff',
    icon: '🏈',
    category: 'college',
    description: '12 teams · top four seeds get byes · First Round, Quarterfinals, Semifinals, Championship',
    teamList: null,
    groups: [{ id: 'L', name: 'Playoff field', short: 'CFP' }],
    slots,
    rounds: rounds(
      [
        ['First Round', 'First Round', 1],
        ['Quarterfinals', 'Quarterfinals', 1],
        ['Semifinals', 'Semifinals', 1],
        ['National Championship', 'Championship', 1],
      ],
      [10, 20, 40, 80],
    ),
    matches: byRound(matches),
    finalId: 'F',
    tiebreaker: 'Total combined points in the National Championship game',
  };
}

const NCAA_REGION_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];

function ncaa(id: string, name: string, league: string): Template {
  const regions: [string, Side, string][] = [
    ['R1', 'L', 'East'],
    ['R2', 'L', 'West'],
    ['R3', 'R', 'South'],
    ['R4', 'R', 'Midwest'],
  ];
  const slots: Slot[] = [];
  const matches: MatchDef[] = [];
  const lasts: string[] = [];
  for (const [r, side] of regions) {
    slots.push(...seededSlots(r, 16, (s) => `#${s} seed`, `${r}-`));
    const b = elim(r, side, 0, NCAA_REGION_ORDER.map((s) => seed(`${r}-${s}`)), r);
    matches.push(...b.matches);
    lasts.push(b.last);
  }
  matches.push({ id: 'FF.1', round: 4, side: 'L', a: win(lasts[0]), b: win(lasts[1]) });
  matches.push({ id: 'FF.2', round: 4, side: 'R', a: win(lasts[2]), b: win(lasts[3]) });
  matches.push({ id: 'F', round: 5, side: 'C', a: win('FF.1'), b: win('FF.2') });
  return {
    id,
    league,
    name,
    icon: '🏀',
    category: 'college',
    description: '64 teams in four regions (enter First Four winners) · six rounds',
    teamList: null,
    groups: regions.map(([gid, , gname]) => ({ id: gid, name: `${gname} Region`, short: gname })),
    renamableGroups: true,
    slots,
    rounds: rounds(
      [
        ['First Round', 'Round of 64', 1],
        ['Second Round', 'Round of 32', 1],
        ['Sweet 16', 'Sweet 16', 1],
        ['Elite Eight', 'Elite Eight', 1],
        ['Final Four', 'Final Four', 1],
        ['National Championship', 'Championship', 1],
      ],
      [10, 20, 40, 80, 160, 320],
    ),
    matches: byRound(matches),
    finalId: 'F',
    tiebreaker: 'Total combined points in the championship game',
    compact: true,
  };
}

// ---------------------------------------------------------------- Custom

/** Standard bracket order: 1 v N, and the top seeds meet as late as possible. */
export function seedOrder(n: number): number[] {
  let order = [1, 2];
  while (order.length < n) {
    const size = order.length * 2;
    order = order.flatMap((s) => [s, size + 1 - s]);
  }
  return order;
}

function custom(n: 4 | 8 | 16): Template {
  const slots = seededSlots('L', n, (s) => `#${s} seed`, 'S');
  const order = seedOrder(n).map((s) => seed(`S${s}`));
  const left = elim('L', 'L', 0, order.slice(0, n / 2));
  const right = elim('R', 'R', 0, order.slice(n / 2));
  const finalRound = Math.log2(n) - 1;
  const names: [string, string, number][] = [
    ['Round of 16', 'Round of 16', 1],
    ['Quarterfinals', 'Quarterfinals', 1],
    ['Semifinals', 'Semifinals', 1],
    ['Final', 'Final', 1],
  ].slice(4 - Math.log2(n)) as [string, string, number][];
  return {
    id: `custom${n}`,
    league: 'Custom',
    name: `Custom ${n}-team bracket`,
    icon: '🏆',
    category: 'custom',
    description: `Any sport or league · ${n} seeded teams, single elimination`,
    teamList: null,
    groups: [{ id: 'L', name: 'Field', short: 'Field' }],
    slots,
    rounds: rounds(names, [10, 20, 40, 80].slice(4 - Math.log2(n))),
    matches: byRound([
      ...left.matches,
      ...right.matches,
      { id: 'F', round: finalRound, side: 'C', a: win(left.last), b: win(right.last) },
    ]),
    finalId: 'F',
    tiebreaker: 'Total combined score in the final',
  };
}

export const TEMPLATES: Template[] = [
  nfl(),
  nba(),
  nhl(),
  mlb(),
  mls(),
  wnba(),
  cfp(),
  ncaa('ncaam', "NCAA Men's Tournament", 'March Madness'),
  ncaa('ncaaw', "NCAA Women's Tournament", 'March Madness'),
  custom(4),
  custom(8),
  custom(16),
];

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): Template | undefined {
  return BY_ID.get(id);
}

export function groupName(t: Template, groupId: string, overrides?: Record<string, string>): string {
  return overrides?.[groupId] || t.groups.find((g) => g.id === groupId)?.short || groupId;
}

