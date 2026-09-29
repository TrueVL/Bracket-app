/** Where a participant of a match comes from. */
export type Source =
  /** A seeded team slot (e.g. "AFC3"). */
  | { seed: string }
  /** The winner of an earlier match. */
  | { winner: string }
  /**
   * Re-seeding: take the winners of `of`, sort them by seed (best first)
   * and use the one at `index`. Used for the NFL divisional round.
   */
  | { rank: { of: string[]; index: number } };

export type Side = 'L' | 'R' | 'C';

export interface Slot {
  /** Stable id used in picks/results, e.g. "E1" or "AFC7". */
  id: string;
  /** Conference / league / region the slot belongs to. */
  group: string;
  /** Numeric seed, used for re-seeding and ordering. */
  seed: number;
  /** Short label shown next to the team, e.g. "1" or "WC". */
  label: string;
  /** Longer description for the setup screen. */
  desc: string;
}

export interface Round {
  name: string;
  short: string;
  /** Series length; 1 for single games. */
  bestOf: number;
  /** Default points for a correct pick in this round. */
  points: number;
}

export interface MatchDef {
  id: string;
  round: number;
  side: Side;
  group?: string;
  a: Source;
  b: Source;
  /** Optional fixed vertical position (in rows) for the bracket layout. */
  y?: number;
}

export interface Group {
  id: string;
  name: string;
  short: string;
}

export type LeagueId = 'nfl' | 'nba' | 'nhl' | 'mlb' | 'mls' | 'wnba';

export interface Template {
  id: string;
  /** Short league name, e.g. "NFL". */
  league: string;
  /** Full title, e.g. "NFL Playoffs". */
  name: string;
  icon: string;
  category: 'pro' | 'college' | 'custom';
  description: string;
  /** Which team list to offer on the setup screen; null = free text. */
  teamList: LeagueId | null;
  groups: Group[];
  /** Whether the commissioner may rename groups (e.g. NCAA regions). */
  renamableGroups?: boolean;
  slots: Slot[];
  rounds: Round[];
  /** Matches ordered so every source refers to an earlier match. */
  matches: MatchDef[];
  finalId: string;
  tiebreaker: string;
  /** Use a denser layout for very large brackets. */
  compact?: boolean;
}

export interface Team {
  name: string;
  short: string;
  abbr: string;
  color: string;
  /** Key into the league team list, if chosen from it. */
  key?: string;
}

export interface Field {
  teams: Record<string, Team>;
  groupNames?: Record<string, string>;
}

/** A set of picks, or the actual results. Both have the same shape. */
export interface Picks {
  /** matchId -> slotId of the winner */
  winners: Record<string, string>;
  /** matchId -> number of games the series lasted (optional) */
  games: Record<string, number>;
}

export interface Scoring {
  /** Points per round for a correct winner. */
  points: number[];
  /** Bonus for also nailing the series length (0 = off). */
  seriesBonus: number;
}

export function emptyPicks(): Picks {
  return { winners: {}, games: {} };
}
