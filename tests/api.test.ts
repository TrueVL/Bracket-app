import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app';
import { openDb, type DB } from '../src/server/db';
import { participants } from '../src/shared/bracket';
import { LEAGUE_TEAMS } from '../src/shared/teams';
import { getTemplate } from '../src/shared/templates';
import type { Picks } from '../src/shared/types';

const H = { 'X-Requested-With': 'bracket-app' };

let db: DB;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp({ db });
});

async function signup(username: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/signup').set(H).send({ username, password: 'password123', displayName: username.toUpperCase() });
  expect(res.status).toBe(201);
  return agent;
}

const nba = getTemplate('nba')!;
function nbaField() {
  const east = LEAGUE_TEAMS.nba.filter((t) => t.conf === 'East');
  const west = LEAGUE_TEAMS.nba.filter((t) => t.conf === 'West');
  const teams: Record<string, { key: string }> = {};
  for (let s = 1; s <= 8; s++) {
    teams[`E${s}`] = { key: east[s - 1].key };
    teams[`W${s}`] = { key: west[s - 1].key };
  }
  return { teams };
}

function chalk(): Picks {
  const winners: Record<string, string> = {};
  for (const m of nba.matches) {
    const [a, b] = participants(nba, m, winners);
    const seed = (id: string) => Number(id.slice(1));
    winners[m.id] = seed(a!) <= seed(b!) ? a! : b!;
  }
  return { winners, games: {} };
}

describe('auth', () => {
  it('signs up, reads the session and logs out', async () => {
    const agent = await signup('ville');
    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toMatchObject({ username: 'ville', displayName: 'VILLE' });
    await agent.post('/api/auth/logout').set(H).expect(200);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });

  it('rejects duplicate usernames and bad passwords', async () => {
    await signup('ville');
    const dup = await request(app).post('/api/auth/signup').set(H).send({ username: 'VILLE', password: 'password123' });
    expect(dup.status).toBe(400);
    const wrong = await request(app).post('/api/auth/login').set(H).send({ username: 'ville', password: 'nope-nope' });
    expect(wrong.status).toBe(401);
    const ok = await request(app).post('/api/auth/login').set(H).send({ username: 'ville', password: 'password123' });
    expect(ok.status).toBe(200);
  });

  it('requires the CSRF header on writes', async () => {
    const res = await request(app).post('/api/auth/signup').send({ username: 'x_user', password: 'password123' });
    expect(res.status).toBe(403);
  });
});

describe('pools', () => {
  it('runs a full pool: create, invite, pick, lock, score', async () => {
    const owner = await signup('owner');
    const friend = await signup('friend');
    const outsider = await signup('outsider');

    const created = await owner
      .post('/api/pools')
      .set(H)
      .send({ name: 'Hoops', templateId: 'nba', season: '2027', scoring: { points: [1, 2, 4, 8], seriesBonus: 0 } });
    expect(created.status).toBe(201);
    const pool = created.body.pool;
    expect(pool.status).toBe('setup');

    // Brackets can't be filled until the field is complete.
    await owner.put(`/api/pools/${pool.id}/bracket`).set(H).send({ picks: chalk() }).expect(400);
    const setup = await owner.patch(`/api/pools/${pool.id}`).set(H).send({ field: nbaField() });
    expect(setup.body.pool.status).toBe('open');
    expect(setup.body.pool.field.teams.E1.name).toBe('Boston Celtics');

    // Outsiders can't see the pool; friends join by invite code.
    await outsider.get(`/api/pools/${pool.id}`).expect(404);
    const preview = await friend.get(`/api/invites/${pool.inviteCode}`);
    expect(preview.body.pool.name).toBe('Hoops');
    await friend.post(`/api/invites/${pool.inviteCode}/join`).set(H).expect(200);

    const mine = await owner.put(`/api/pools/${pool.id}/bracket`).set(H).send({ picks: chalk(), tiebreaker: 210 });
    expect(Object.keys(mine.body.bracket.picks.winners)).toHaveLength(15);
    const upset = chalk();
    upset.winners = { 'E.0.1': 'E8' }; // only one pick, an upset
    const theirs = await friend.put(`/api/pools/${pool.id}/bracket`).set(H).send({ picks: upset, name: 'Chaos' });

    // Before lock, other brackets are private.
    await friend.get(`/api/brackets/${mine.body.bracket.id}`).expect(403);
    const board = (await friend.get(`/api/pools/${pool.id}`)).body.pool.leaderboard;
    expect(board.find((r: { username: string }) => r.username === 'owner').championSlot).toBeNull();

    // Lock the pool and enter a result.
    await owner.patch(`/api/pools/${pool.id}`).set(H).send({ lockAt: Date.now() - 1000 }).expect(200);
    await friend.put(`/api/pools/${pool.id}/bracket`).set(H).send({ picks: chalk() }).expect(400);
    await friend.put(`/api/pools/${pool.id}/results`).set(H).send({ results: upset }).expect(403);
    const res = await owner.put(`/api/pools/${pool.id}/results`).set(H).send({ results: { winners: { 'E.0.1': 'E8' }, games: {} } });
    expect(res.status).toBe(200);
    const rows = res.body.pool.leaderboard;
    expect(rows[0]).toMatchObject({ username: 'friend', rank: 1, visible: true });
    expect(rows[0].score.points).toBe(1);
    expect(rows[1].score.points).toBe(0);
    expect(rows[1].championSlot).toBe('E1');

    // After lock, bracket links work for anyone.
    const view = await request(app).get(`/api/brackets/${theirs.body.bracket.id}`);
    expect(view.status).toBe(200);
    expect(view.body.bracket.name).toBe('Chaos');
    expect(view.body.rank).toBe(1);

    const list = await friend.get('/api/pools');
    expect(list.body.pools[0]).toMatchObject({ name: 'Hoops', myRank: 1, myPoints: 1 });
  });

  it('only lets the commissioner manage the pool', async () => {
    const owner = await signup('owner');
    const friend = await signup('friend');
    const { pool } = (await owner.post('/api/pools').set(H).send({ name: 'P', templateId: 'nfl' })).body;
    await friend.post(`/api/invites/${pool.inviteCode}/join`).set(H).expect(200);
    await friend.patch(`/api/pools/${pool.id}`).set(H).send({ name: 'Mine now' }).expect(403);
    await friend.delete(`/api/pools/${pool.id}`).set(H).expect(403);
    await friend.delete(`/api/pools/${pool.id}/members/${pool.ownerId}`).set(H).expect(400);
    // Members can leave.
    const me = (await friend.get('/api/auth/me')).body.user;
    await friend.delete(`/api/pools/${pool.id}/members/${me.id}`).set(H).expect(200);
    await friend.get(`/api/pools/${pool.id}`).expect(404);
    await owner.delete(`/api/pools/${pool.id}`).set(H).expect(200);
  });

  it('validates custom teams', async () => {
    const owner = await signup('owner');
    const { pool } = (await owner.post('/api/pools').set(H).send({ name: 'Custom', templateId: 'custom4' })).body;
    const res = await owner
      .patch(`/api/pools/${pool.id}`)
      .set(H)
      .send({ field: { teams: { S1: { name: 'Sharks', abbr: 'shk', color: '#123456' }, S2: { name: 'Jets' }, S3: { name: 'Owls' }, S4: { name: 'Jets' } } } });
    expect(res.body.pool.field.teams.S1).toMatchObject({ name: 'Sharks', abbr: 'SHK', color: '#123456' });
    expect(res.body.pool.fieldProblems).toEqual(['Jets is entered twice']);
    expect(res.body.pool.status).toBe('setup');
  });
});

describe('robustness', () => {
  it('handles missing bodies and bad cookies without crashing', async () => {
    const res = await request(app).post('/api/auth/login').set(H);
    expect(res.status).toBe(401);
    const me = await request(app).get('/api/auth/me').set('Cookie', 'bracket_session=%E0%A4%A');
    expect(me.status).toBe(200);
    expect(me.body.user).toBeNull();
  });
});

describe('session cookie', () => {
  it('is marked Secure only when the request came over HTTPS', async () => {
    const plain = await request(app).post('/api/auth/signup').set(H).send({ username: 'plain', password: 'password123' });
    expect(plain.headers['set-cookie'][0]).not.toMatch(/Secure/);
    const https = await request(app)
      .post('/api/auth/signup')
      .set(H)
      .set('X-Forwarded-Proto', 'https')
      .send({ username: 'secure', password: 'password123' });
    expect(https.headers['set-cookie'][0]).toMatch(/Secure/);
    expect(https.headers['set-cookie'][0]).toMatch(/HttpOnly/);
  });
});
