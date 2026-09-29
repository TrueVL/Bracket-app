import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { InvitePreview, UserDTO } from '../shared/api';
import { sanitize } from '../shared/bracket';
import { getTemplate } from '../shared/templates';
import type { Field, Picks } from '../shared/types';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  destroySession,
  hashPassword,
  newId,
  rateLimiter,
  readCookie,
  requireUser,
  setSessionCookie,
  userForToken,
  verifyPassword,
} from './auth';
import { transaction, type BracketRow, type DB, type PoolRow, type UserRow } from './db';
import {
  bracketDTO,
  bracketView,
  hydratePool,
  isMember,
  loadMemberPool,
  loadOwnedPool,
  loadPool,
  poolDetail,
  poolSummaries,
} from './pools';
import * as v from './validate';
import { HttpError, bad } from './validate';

export interface AppOptions {
  db: DB;
  /** Directory with the built client; served when present. */
  clientDir?: string;
  /** In development the site is served by Vite; send page requests there. */
  devClientUrl?: string;
  /** Force the Secure cookie flag on/off. By default it follows the request (HTTPS or not). */
  secureCookies?: boolean;
}

const userDTO = (u: UserRow): UserDTO => ({ id: u.id, username: u.username, displayName: u.display_name });

const inviteCode = () => newId(8).toUpperCase().replace(/[^A-Z0-9]/g, 'X');

export function createApp({ db, clientDir, devClientUrl, secureCookies }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  const api = express.Router();
  api.use(express.json({ limit: '200kb' }));
  api.use((req, _res, next) => {
    if (!req.body || typeof req.body !== 'object') req.body = {};
    next();
  });

  // CSRF defence: browsers can't add custom headers to cross-site requests
  // without a CORS preflight, which this server never approves.
  api.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('x-requested-with') !== 'bracket-app') {
      res.status(403).json({ error: 'Missing request header.' });
      return;
    }
    next();
  });

  api.use((req, _res, next) => {
    req.user = userForToken(db, readCookie(req, SESSION_COOKIE));
    next();
  });

  const authLimit = rateLimiter(20, 15 * 60_000);

  // ------------------------------------------------------------ auth

  api.post('/auth/signup', authLimit, async (req, res) => {
    const username = v.str(req.body.username, 'Username', 3, 20);
    if (!/^[a-zA-Z0-9_]+$/.test(username)) throw bad('Usernames can only use letters, numbers and underscores.');
    const displayName = v.str(req.body.displayName || username, 'Display name', 1, 40);
    const password = v.str(req.body.password, 'Password', 8, 200);
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw bad('That username is taken.');
    const user: UserRow = {
      id: newId(),
      username,
      display_name: displayName,
      password_hash: await hashPassword(password),
      created_at: Date.now(),
    };
    db.prepare(
      'INSERT INTO users (id, username, display_name, password_hash, created_at) VALUES (@id, @username, @display_name, @password_hash, @created_at)',
    ).run(user);
    const { token, expires } = createSession(db, user.id);
    setSessionCookie(res, token, expires, secureCookies ?? req.secure);
    res.status(201).json({ user: userDTO(user) });
  });

  api.post('/auth/login', authLimit, async (req, res) => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new HttpError(401, 'Wrong username or password.');
    }
    const { token, expires } = createSession(db, user.id);
    setSessionCookie(res, token, expires, secureCookies ?? req.secure);
    res.json({ user: userDTO(user) });
  });

  api.post('/auth/logout', (req, res) => {
    destroySession(db, readCookie(req, SESSION_COOKIE));
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  api.get('/auth/me', (req, res) => {
    res.json({ user: req.user ? userDTO(req.user) : null });
  });

  api.patch('/auth/me', requireUser, async (req, res) => {
    const user = req.user!;
    if (req.body.displayName !== undefined) {
      const displayName = v.str(req.body.displayName, 'Display name', 1, 40);
      db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, user.id);
    }
    if (req.body.newPassword !== undefined) {
      const current = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
      if (!(await verifyPassword(current, user.password_hash))) throw bad('Your current password is incorrect.');
      const hash = await hashPassword(v.str(req.body.newPassword, 'New password', 8, 200));
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    }
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow;
    res.json({ user: userDTO(fresh) });
  });

  // ------------------------------------------------------------ pools

  api.get('/pools', requireUser, (req, res) => {
    res.json({ pools: poolSummaries(db, req.user!) });
  });

  api.post('/pools', requireUser, (req, res) => {
    const t = getTemplate(String(req.body.templateId));
    if (!t) throw bad('Pick a league for your bracket.');
    const now = Date.now();
    const row: PoolRow = {
      id: newId(),
      name: v.str(req.body.name, 'Pool name', 1, 60),
      template_id: t.id,
      season: typeof req.body.season === 'string' ? v.str(req.body.season, 'Season', 0, 20) : '',
      owner_id: req.user!.id,
      invite_code: inviteCode(),
      field_json: JSON.stringify(req.body.field ? v.field(req.body.field, t) : { teams: {} }),
      results_json: JSON.stringify({ winners: {}, games: {} }),
      scoring_json: JSON.stringify(v.scoring(req.body.scoring, t)),
      lock_at: v.lockAt(req.body.lockAt),
      tiebreaker_actual: null,
      created_at: now,
      updated_at: now,
    };
    transaction(db, () => {
      db.prepare(
        `INSERT INTO pools (id, name, template_id, season, owner_id, invite_code, field_json, results_json, scoring_json, lock_at, tiebreaker_actual, created_at, updated_at)
         VALUES (@id, @name, @template_id, @season, @owner_id, @invite_code, @field_json, @results_json, @scoring_json, @lock_at, @tiebreaker_actual, @created_at, @updated_at)`,
      ).run(row);
      db.prepare('INSERT INTO pool_members (pool_id, user_id, joined_at) VALUES (?, ?, ?)').run(row.id, req.user!.id, now);
    });
    res.status(201).json({ pool: poolDetail(db, hydratePool(row), req.user!) });
  });

  api.get('/pools/:id', requireUser, (req, res) => {
    const pool = loadMemberPool(db, String(req.params.id), req.user!);
    res.json({ pool: poolDetail(db, pool, req.user!) });
  });

  api.patch('/pools/:id', requireUser, (req, res) => {
    const pool = loadOwnedPool(db, String(req.params.id), req.user!);
    const b = req.body as Record<string, unknown>;
    const next = { ...pool.row };
    if (b.name !== undefined) next.name = v.str(b.name, 'Pool name', 1, 60);
    if (b.season !== undefined) next.season = v.str(b.season, 'Season', 0, 20);
    if (b.lockAt !== undefined) next.lock_at = v.lockAt(b.lockAt);
    if (b.scoring !== undefined) next.scoring_json = JSON.stringify(v.scoring(b.scoring, pool.template));
    if (b.tiebreakerActual !== undefined) next.tiebreaker_actual = v.optionalNumber(b.tiebreakerActual, 'Tiebreaker');
    if (b.field !== undefined) {
      if (pool.locked) throw bad('Teams can’t change once the pool is locked.');
      next.field_json = JSON.stringify(v.field(b.field, pool.template) satisfies Field);
    }
    next.updated_at = Date.now();
    db.prepare(
      `UPDATE pools SET name = @name, season = @season, lock_at = @lock_at, scoring_json = @scoring_json,
       tiebreaker_actual = @tiebreaker_actual, field_json = @field_json, updated_at = @updated_at WHERE id = @id`,
    ).run({
      id: next.id,
      name: next.name,
      season: next.season,
      lock_at: next.lock_at,
      scoring_json: next.scoring_json,
      tiebreaker_actual: next.tiebreaker_actual,
      field_json: next.field_json,
      updated_at: next.updated_at,
    });
    res.json({ pool: poolDetail(db, loadPool(db, pool.row.id), req.user!) });
  });

  api.put('/pools/:id/results', requireUser, (req, res) => {
    const pool = loadOwnedPool(db, String(req.params.id), req.user!);
    if (pool.problems.length) throw bad('Finish setting up the teams first.');
    const results = sanitize(pool.template, req.body.results as Partial<Picks>);
    const tiebreaker =
      req.body.tiebreakerActual === undefined ? pool.row.tiebreaker_actual : v.optionalNumber(req.body.tiebreakerActual, 'Tiebreaker');
    db.prepare('UPDATE pools SET results_json = ?, tiebreaker_actual = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(results),
      tiebreaker,
      Date.now(),
      pool.row.id,
    );
    res.json({ pool: poolDetail(db, loadPool(db, pool.row.id), req.user!) });
  });

  api.post('/pools/:id/invite', requireUser, (req, res) => {
    const pool = loadOwnedPool(db, String(req.params.id), req.user!);
    db.prepare('UPDATE pools SET invite_code = ? WHERE id = ?').run(inviteCode(), pool.row.id);
    res.json({ pool: poolDetail(db, loadPool(db, pool.row.id), req.user!) });
  });

  api.delete('/pools/:id', requireUser, (req, res) => {
    const pool = loadOwnedPool(db, String(req.params.id), req.user!);
    db.prepare('DELETE FROM pools WHERE id = ?').run(pool.row.id);
    res.json({ ok: true });
  });

  api.delete('/pools/:id/members/:userId', requireUser, (req, res) => {
    const pool = loadMemberPool(db, String(req.params.id), req.user!);
    const target = String(req.params.userId);
    const isOwner = pool.row.owner_id === req.user!.id;
    if (target === pool.row.owner_id) throw bad('The commissioner can’t leave. Delete the pool instead.');
    if (target !== req.user!.id && !isOwner) throw new HttpError(403, 'Only the commissioner can remove members.');
    transaction(db, () => {
      db.prepare('DELETE FROM brackets WHERE pool_id = ? AND user_id = ?').run(pool.row.id, target);
      db.prepare('DELETE FROM pool_members WHERE pool_id = ? AND user_id = ?').run(pool.row.id, target);
    });
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ brackets

  api.put('/pools/:id/bracket', requireUser, (req, res) => {
    const pool = loadMemberPool(db, String(req.params.id), req.user!);
    if (pool.problems.length) throw bad('The commissioner hasn’t finished setting up the teams yet.');
    if (pool.locked) throw bad('This pool is locked — picks can’t change anymore.');
    const picks = sanitize(pool.template, req.body.picks as Partial<Picks>);
    const name = req.body.name ? v.str(req.body.name, 'Bracket name', 1, 40) : `${req.user!.display_name}'s bracket`;
    const tiebreaker = v.optionalNumber(req.body.tiebreaker, 'Tiebreaker');
    const now = Date.now();
    db.prepare(
      `INSERT INTO brackets (id, pool_id, user_id, name, picks_json, tiebreaker, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (pool_id, user_id) DO UPDATE SET
         name = excluded.name, picks_json = excluded.picks_json,
         tiebreaker = excluded.tiebreaker, updated_at = excluded.updated_at`,
    ).run(newId(), pool.row.id, req.user!.id, name, JSON.stringify(picks), tiebreaker, now, now);
    db.prepare('UPDATE pools SET updated_at = ? WHERE id = ?').run(now, pool.row.id);
    const row = db.prepare('SELECT * FROM brackets WHERE pool_id = ? AND user_id = ?').get(pool.row.id, req.user!.id) as BracketRow;
    res.json({ bracket: bracketDTO(pool, row, req.user!.display_name) });
  });

  api.delete('/pools/:id/bracket', requireUser, (req, res) => {
    const pool = loadMemberPool(db, String(req.params.id), req.user!);
    if (pool.locked) throw bad('This pool is locked — picks can’t change anymore.');
    db.prepare('DELETE FROM brackets WHERE pool_id = ? AND user_id = ?').run(pool.row.id, req.user!.id);
    res.json({ ok: true });
  });

  api.get('/brackets/:id', (req, res) => {
    res.json(bracketView(db, String(req.params.id), req.user));
  });

  // ------------------------------------------------------------ invites

  const findByCode = (code: string) => {
    const row = db.prepare('SELECT * FROM pools WHERE invite_code = ?').get(code.toUpperCase()) as PoolRow | undefined;
    if (!row) throw new HttpError(404, 'That invite link isn’t valid anymore. Ask for a new one.');
    return hydratePool(row);
  };

  api.get('/invites/:code', (req, res) => {
    const pool = findByCode(String(req.params.code));
    const owner = db.prepare('SELECT display_name FROM users WHERE id = ?').get(pool.row.owner_id) as { display_name: string };
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM pool_members WHERE pool_id = ?').get(pool.row.id) as { n: number };
    const body: InvitePreview = {
      pool: {
        id: pool.row.id,
        name: pool.row.name,
        templateId: pool.row.template_id,
        season: pool.row.season,
        ownerName: owner.display_name,
        memberCount: n,
        status: pool.status,
      },
      isMember: isMember(db, pool.row.id, req.user?.id),
    };
    res.json(body);
  });

  api.post('/invites/:code/join', requireUser, (req, res) => {
    const pool = findByCode(String(req.params.code));
    db.prepare('INSERT OR IGNORE INTO pool_members (pool_id, user_id, joined_at) VALUES (?, ?, ?)').run(
      pool.row.id,
      req.user!.id,
      Date.now(),
    );
    res.json({ poolId: pool.row.id });
  });

  api.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON.' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our end.' });
  });

  app.use('/api', api);

  if (devClientUrl) {
    app.get('/{*path}', (req, res) => {
      res.redirect(devClientUrl + req.originalUrl);
    });
  } else if (clientDir && fs.existsSync(path.join(clientDir, 'index.html'))) {
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  } else {
    app.get('/{*path}', (_req, res) => {
      res
        .status(503)
        .type('html')
        .send(
          '<!doctype html><meta charset="utf-8"><title>Bracket Club</title>' +
            '<body style="font-family:system-ui;max-width:560px;margin:60px auto;padding:0 16px;line-height:1.5">' +
            '<h1>The site isn’t built yet</h1><p>This is the app’s server, but the website files haven’t been built.</p>' +
            '<ul><li>For development, run <code>npm run dev</code> and open <a href="http://localhost:5173">http://localhost:5173</a>.</li>' +
            '<li>To run the real site, run <code>npm run build</code> and then <code>npm start</code>.</li></ul></body>',
        );
    });
  }

  return app;
}
