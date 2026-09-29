import type { Score } from './bracket';
import type { Field, Picks, Scoring } from './types';

/** Shapes returned by the JSON API, shared by server and client. */

export interface UserDTO {
  id: string;
  username: string;
  displayName: string;
}

export type PoolStatus = 'setup' | 'open' | 'locked' | 'final';

export interface PoolSummary {
  id: string;
  name: string;
  templateId: string;
  season: string;
  ownerName: string;
  isOwner: boolean;
  memberCount: number;
  lockAt: number | null;
  status: PoolStatus;
  myBracketId: string | null;
  myPickCount: number;
  totalPicks: number;
  myRank: number | null;
  myPoints: number | null;
  championSlot: string | null;
  field: Field;
}

export interface LeaderRow {
  userId: string;
  displayName: string;
  username: string;
  isOwner: boolean;
  bracketId: string | null;
  bracketName: string | null;
  pickCount: number;
  rank: number | null;
  score: Score | null;
  /** Only present when the viewer may see this bracket. */
  championSlot: string | null;
  tiebreaker: number | null;
  visible: boolean;
}

export interface BracketDTO {
  id: string;
  poolId: string;
  userId: string;
  ownerName: string;
  name: string;
  picks: Picks;
  tiebreaker: number | null;
  updatedAt: number;
}

export interface PoolDetail {
  id: string;
  name: string;
  templateId: string;
  season: string;
  inviteCode: string;
  ownerId: string;
  ownerName: string;
  isOwner: boolean;
  lockAt: number | null;
  locked: boolean;
  status: PoolStatus;
  field: Field;
  fieldProblems: string[];
  results: Picks;
  scoring: Scoring;
  tiebreakerActual: number | null;
  leaderboard: LeaderRow[];
  myBracket: BracketDTO | null;
}

export interface BracketView {
  bracket: BracketDTO;
  score: Score;
  rank: number | null;
  entries: number;
  isMine: boolean;
  isMember: boolean;
  pool: {
    id: string;
    name: string;
    templateId: string;
    season: string;
    field: Field;
    results: Picks;
    scoring: Scoring;
    lockAt: number | null;
    locked: boolean;
    status: PoolStatus;
    tiebreakerActual: number | null;
  };
}

export interface InvitePreview {
  pool: {
    id: string;
    name: string;
    templateId: string;
    season: string;
    ownerName: string;
    memberCount: number;
    status: PoolStatus;
  };
  isMember: boolean;
}
