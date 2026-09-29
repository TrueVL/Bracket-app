import type { BracketDTO, BracketView, LeaderRow, PoolDetail, PoolStatus, PoolSummary } from '../shared/api';
import { champion, fieldProblems, isFinal, pickCount, rankEntries, sanitize, scoreBracket } from '../shared/bracket';
import { getTemplate } from '../shared/templates';
import type { Field, Picks, Scoring, Template } from '../shared/types';
import type { BracketRow, DB, PoolRow, UserRow } from './db';
import { HttpError } from './validate';

export interface Pool {
  row: PoolRow;
  template: Template;
  field: Field;
  results: Picks;
  scoring: Scoring;
  locked: boolean;
  status: PoolStatus;
  problems: string[];
}

export function hydratePool(row: PoolRow): Pool {
  const template = getTemplate(row.template_id);
  if (!template) throw new HttpError(500, `Unknown bracket type ${row.template_id}`);
  const field = JSON.parse(row.field_json) as Field;
  const results = sanitize(template, JSON.parse(row.results_json));
  const scoring = JSON.parse(row.scoring_json) as Scoring;
  const locked = row.lock_at !== null && row.lock_at <= Date.now();
  const problems = fieldProblems(template, field);
  const status: PoolStatus = problems.length ? 'setup' : isFinal(template, results) ? 'final' : locked ? 'locked' : 'open';
  return { row, template, field, results, scoring, locked, status, problems };
}

export function loadPool(db: DB, id: string): Pool {
  const row = db.prepare('SELECT * FROM pools WHERE id = ?').get(id) as PoolRow | undefined;
  if (!row) throw new HttpError(404, 'Pool not found.');
  return hydratePool(row);
}

export function isMember(db: DB, poolId: string, userId: string | undefined): boolean {
  if (!userId) return false;
  return Boolean(db.prepare('SELECT 1 FROM pool_members WHERE pool_id = ? AND user_id = ?').get(poolId, userId));
}

export function loadMemberPool(db: DB, id: string, user: UserRow): Pool {
  const pool = loadPool(db, id);
  // Hide the pool's existence from non-members.
  if (!isMember(db, id, user.id)) throw new HttpError(404, 'Pool not found.');
  return pool;
}

export function loadOwnedPool(db: DB, id: string, user: UserRow): Pool {
  const pool = loadMemberPool(db, id, user);
  if (pool.row.owner_id !== user.id) throw new HttpError(403, 'Only the commissioner can do that.');
  return pool;
}

function bracketPicks(pool: Pool, b: BracketRow): Picks {
  return sanitize(pool.template, JSON.parse(b.picks_json));
}

export function bracketDTO(pool: Pool, b: BracketRow, ownerName: string): BracketDTO {
  return {
    id: b.id,
    poolId: b.pool_id,
    userId: b.user_id,
    ownerName,
    name: b.name,
    picks: bracketPicks(pool, b),
    tiebreaker: b.tiebreaker,
    updatedAt: b.updated_at,
  };
}

interface MemberRow {
  user_id: string;
  username: string;
  display_name: string;
  bracket_id: string | null;
}

/** Build the standings for a pool from the viewer's point of view. */
export function leaderboard(db: DB, pool: Pool, viewerId: string | undefined): LeaderRow[] {
  const members = db
    .prepare(
      `SELECT m.user_id, u.username, u.display_name, b.id AS bracket_id
       FROM pool_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN brackets b ON b.pool_id = m.pool_id AND b.user_id = m.user_id
       WHERE m.pool_id = ?
       ORDER BY m.joined_at`,
    )
    .all(pool.row.id) as MemberRow[];
  const brackets = new Map(
    (db.prepare('SELECT * FROM brackets WHERE pool_id = ?').all(pool.row.id) as BracketRow[]).map((b) => [b.id, b]),
  );

  const scored = members.flatMap((m) => {
    const b = m.bracket_id ? brackets.get(m.bracket_id) : undefined;
    if (!b) return [];
    const picks = bracketPicks(pool, b);
    const score = scoreBracket(pool.template, pool.scoring, picks, pool.results);
    return [{ id: b.id, name: m.display_name, points: score.points, tiebreaker: b.tiebreaker, score, picks, b }];
  });
  const ranked = new Map(rankEntries(scored, pool.row.tiebreaker_actual).map((r) => [r.id, r]));

  const rows: LeaderRow[] = members.map((m) => {
    const r = m.bracket_id ? ranked.get(m.bracket_id) : undefined;
    const visible = Boolean(r) && (pool.locked || m.user_id === viewerId);
    return {
      userId: m.user_id,
      displayName: m.display_name,
      username: m.username,
      isOwner: m.user_id === pool.row.owner_id,
      bracketId: r?.b.id ?? null,
      bracketName: r?.b.name ?? null,
      pickCount: r ? pickCount(pool.template, r.picks) : 0,
      rank: r?.rank ?? null,
      score: r?.score ?? null,
      championSlot: visible && r ? champion(pool.template, r.picks) : null,
      tiebreaker: visible && r ? r.b.tiebreaker : null,
      visible,
    };
  });
  return rows.sort((x, y) => (x.rank ?? Infinity) - (y.rank ?? Infinity));
}

export function poolDetail(db: DB, pool: Pool, user: UserRow): PoolDetail {
  const owner = db.prepare('SELECT display_name FROM users WHERE id = ?').get(pool.row.owner_id) as { display_name: string };
  const mine = db.prepare('SELECT * FROM brackets WHERE pool_id = ? AND user_id = ?').get(pool.row.id, user.id) as
    | BracketRow
    | undefined;
  return {
    id: pool.row.id,
    name: pool.row.name,
    templateId: pool.row.template_id,
    season: pool.row.season,
    inviteCode: pool.row.invite_code,
    ownerId: pool.row.owner_id,
    ownerName: owner.display_name,
    isOwner: pool.row.owner_id === user.id,
    lockAt: pool.row.lock_at,
    locked: pool.locked,
    status: pool.status,
    field: pool.field,
    fieldProblems: pool.problems,
    results: pool.results,
    scoring: pool.scoring,
    tiebreakerActual: pool.row.tiebreaker_actual,
    leaderboard: leaderboard(db, pool, user.id),
    myBracket: mine ? bracketDTO(pool, mine, user.display_name) : null,
  };
}

export function poolSummaries(db: DB, user: UserRow): PoolSummary[] {
  const rows = db
    .prepare(
      `SELECT p.* FROM pools p JOIN pool_members m ON m.pool_id = p.id
       WHERE m.user_id = ? ORDER BY p.updated_at DESC`,
    )
    .all(user.id) as PoolRow[];
  return rows.map((row) => {
    const pool = hydratePool(row);
    const board = leaderboard(db, pool, user.id);
    const me = board.find((r) => r.userId === user.id);
    const owner = board.find((r) => r.isOwner);
    return {
      id: row.id,
      name: row.name,
      templateId: row.template_id,
      season: row.season,
      ownerName: owner?.displayName ?? '',
      isOwner: row.owner_id === user.id,
      memberCount: board.length,
      lockAt: row.lock_at,
      status: pool.status,
      myBracketId: me?.bracketId ?? null,
      myPickCount: me?.pickCount ?? 0,
      totalPicks: pool.template.matches.length,
      myRank: me?.rank ?? null,
      myPoints: me?.score?.points ?? null,
      championSlot: me?.championSlot ?? null,
      field: pool.field,
    };
  });
}

export function bracketView(db: DB, bracketId: string, viewer: UserRow | undefined): BracketView {
  const b = db.prepare('SELECT * FROM brackets WHERE id = ?').get(bracketId) as BracketRow | undefined;
  if (!b) throw new HttpError(404, 'Bracket not found.');
  const pool = loadPool(db, b.pool_id);
  const isMine = viewer?.id === b.user_id;
  if (!isMine && !pool.locked) throw new HttpError(403, 'Picks stay hidden until the pool locks. Check back once the playoffs start!');
  const owner = db.prepare('SELECT display_name FROM users WHERE id = ?').get(b.user_id) as { display_name: string };
  const board = leaderboard(db, pool, viewer?.id);
  const entry = board.find((r) => r.bracketId === b.id);
  const dto = bracketDTO(pool, b, owner.display_name);
  return {
    bracket: dto,
    score: scoreBracket(pool.template, pool.scoring, dto.picks, pool.results),
    rank: entry?.rank ?? null,
    entries: board.filter((r) => r.bracketId).length,
    isMine,
    isMember: isMember(db, pool.row.id, viewer?.id),
    pool: {
      id: pool.row.id,
      name: pool.row.name,
      templateId: pool.row.template_id,
      season: pool.row.season,
      field: pool.field,
      results: pool.results,
      scoring: pool.scoring,
      lockAt: pool.row.lock_at,
      locked: pool.locked,
      status: pool.status,
      tiebreakerActual: pool.row.tiebreaker_actual,
    },
  };
}
