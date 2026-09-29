import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * SQLite is built into Node.js (22.13+), so there is no native module to
 * compile on install. Node prints an "experimental" notice the first time
 * it loads; it's noise for users of this app, so it's filtered out here.
 */
function loadSqlite(): typeof import('node:sqlite') {
  const emit = process.emitWarning;
  process.emitWarning = function (warning: string | Error, ...rest: unknown[]) {
    const message = typeof warning === 'string' ? warning : warning.message;
    if (message.includes('SQLite')) return;
    return (emit as (...args: unknown[]) => void).call(process, warning, ...rest);
  } as typeof process.emitWarning;
  try {
    return createRequire(import.meta.url)('node:sqlite');
  } finally {
    process.emitWarning = emit;
  }
}

/** The slice of node:sqlite this app uses; rows are cast to the *Row types below. */
export interface Statement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
export interface DB {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  close(): void;
}

/** Run `fn` inside a transaction, rolling back if it throws. */
export function transaction(db: DB, fn: () => void) {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS pools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_id TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL REFERENCES users(id),
  invite_code TEXT NOT NULL UNIQUE,
  field_json TEXT NOT NULL,
  results_json TEXT NOT NULL,
  scoring_json TEXT NOT NULL,
  lock_at INTEGER,
  tiebreaker_actual REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pool_members (
  pool_id TEXT NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (pool_id, user_id)
);
CREATE INDEX IF NOT EXISTS pool_members_user ON pool_members(user_id);

CREATE TABLE IF NOT EXISTS brackets (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  picks_json TEXT NOT NULL,
  tiebreaker REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (pool_id, user_id)
);
`;

export function openDb(file = process.env.DATABASE_PATH ?? path.resolve('data', 'bracket.db')): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(file) as unknown as DB;
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  created_at: number;
}

export interface PoolRow {
  id: string;
  name: string;
  template_id: string;
  season: string;
  owner_id: string;
  invite_code: string;
  field_json: string;
  results_json: string;
  scoring_json: string;
  lock_at: number | null;
  tiebreaker_actual: number | null;
  created_at: number;
  updated_at: number;
}

export interface BracketRow {
  id: string;
  pool_id: string;
  user_id: string;
  name: string;
  picks_json: string;
  tiebreaker: number | null;
  created_at: number;
  updated_at: number;
}
