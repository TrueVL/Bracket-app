import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type DB = Database.Database;

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
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
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
