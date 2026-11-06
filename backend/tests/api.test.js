import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import helpers from './helpers';

const { PASSWORD, startApp, stopApp, createUser, loginAs, request } = helpers;

let app;
let users;
const auth = (agent) => ({ Authorization: `Bearer ${agent.token}` });

beforeAll(async () => {
  app = await startApp();
  users = {
    superadmin: await createUser('root', 'superadmin'),
    admin: await createUser('mark', 'admin'),
    tabulator: await createUser('al', 'tabulator'),
    grievance: await createUser('kibra', 'grievance'),
    pending: await createUser('phil', 'tabulator', { approved: false })
  };
}, 120000);

afterAll(stopApp);

describe('health and errors', () => {
  it('reports the API is running', async () => {
    const res = await request(app).get('/api');
    expect(res.status).toBe(200);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('rejects malformed JSON without leaking details', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .set('Content-Type', 'application/json')
      .send('{"username":');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Malformed JSON body.');
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('auth', () => {
  it('logs in an approved user', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ username: users.admin.username, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('blocks pending accounts', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ username: users.pending.username, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('rejects operator injection in login', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ username: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('validates registration input', async () => {
    const short = await request(app).post('/api/users/register').send({ username: 'newbie', password: '123' });
    expect(short.status).toBe(400);
    expect(short.body.message).toMatch(/password/);

    const admin = await request(app)
      .post('/api/users/register')
      .send({ username: 'sneaky', password: 'long-enough-pw', role: 'admin' });
    expect(admin.status).toBe(400);
  });
});

describe('role guards', () => {
  it('forbids tabulators from the audit trail', async () => {
    const agent = await loginAs(app, users.tabulator);
    const res = await agent.get('/api/audits').set(auth(agent));
    expect(res.status).toBe(403);
  });

  it('lets superadmin use admin routes', async () => {
    const agent = await loginAs(app, users.superadmin);
    const res = await agent.get('/api/events').set(auth(agent));
    expect(res.status).toBe(200);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
  });
});

describe('events, scores and deductions', () => {
  let admin;
  let eventId;
  let contestantId;

  beforeAll(async () => {
    admin = await loginAs(app, users.admin);
  });

  it('creates an event and strips unknown fields', async () => {
    const res = await admin
      .post('/api/events')
      .set(auth(admin))
      .send({
        name: 'Ms. Intrams',
        category: 'Special Events Category',
        scoringMode: 'criteria',
        requiredTalliers: 1,
        criteria: [{ label: 'Beauty', weight: 100, maxScore: 50 }],
        tabulatorId: String(users.tabulator._id),
        completedTalliers: 99,
        finalizedAt: '2020-01-01'
      });
    expect(res.status).toBe(201);
    const event = res.body.event || res.body;
    expect(event.completedTalliers).toBe(0);
    expect(event.finalizedAt).toBeNull();
    eventId = event._id;
  });

  it('rejects an event with an invalid category', async () => {
    const res = await admin.post('/api/events').set(auth(admin)).send({ name: 'X', category: 'Nope' });
    expect(res.status).toBe(400);
  });

  it('adds a contestant', async () => {
    const res = await admin
      .post('/api/contestants')
      .set(auth(admin))
      .send({ name: 'Contestant One', eventId, contestantNumber: 1 });
    expect(res.status).toBe(201);
    contestantId = (res.body.contestant || res.body)._id;
  });

  it('records a score from the assigned tabulator', async () => {
    const tab = await loginAs(app, users.tabulator);
    const res = await tab
      .post('/api/scores/record')
      .set(auth(tab))
      .send({
        eventId,
        contestantId,
        physicalJudgeName: 'Judge A',
        scores: [{ criteriaName: 'Beauty', value: 45 }]
      });
    expect(res.status).toBe(201);
  });

  it('validates grievance deductions', async () => {
    const griev = await loginAs(app, users.grievance);
    const missing = await griev
      .patch(`/api/contestants/${contestantId}/deduct`)
      .set(auth(griev))
      .send({ deductionPoints: 2 });
    expect(missing.status).toBe(400);

    const ok = await griev
      .patch(`/api/contestants/${contestantId}/deduct`)
      .set(auth(griev))
      .send({ deductionPoints: 2, reason: 'Late entrance' });
    expect(ok.status).toBe(200);
  });

  it('exports a backup without password hashes', async () => {
    const res = await admin.get('/api/admin/backup').set(auth(admin));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.text);
    expect(body.collections.users.length).toBeGreaterThan(0);
    expect(body.collections.users.every((user) => !('password' in user))).toBe(true);
  });

  it('serves the public leaderboard without auth', async () => {
    const res = await request(app).get('/api/public/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leaderboard');
  });
});
