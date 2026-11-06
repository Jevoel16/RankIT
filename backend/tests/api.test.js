import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import helpers from './helpers';

const { APP_HEADER, PASSWORD, startApp, stopApp, createUser, loginAs, request } = helpers;

let app;
let users;

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
      .set(APP_HEADER)
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
      .set(APP_HEADER)
      .send({ username: users.admin.username, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('blocks pending accounts', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .set(APP_HEADER)
      .send({ username: users.pending.username, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('rejects operator injection in login', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .set(APP_HEADER)
      .send({ username: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('validates registration input', async () => {
    const short = await request(app).post('/api/users/register').set(APP_HEADER).send({ username: 'newbie', password: '123' });
    expect(short.status).toBe(400);
    expect(short.body.message).toMatch(/password/);

    const admin = await request(app)
      .post('/api/users/register')
      .set(APP_HEADER)
      .send({ username: 'sneaky', password: 'long-enough-pw', role: 'admin' });
    expect(admin.status).toBe(400);
  });
});

describe('session cookie', () => {
  it('sets an httpOnly session cookie and returns no token', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .set(APP_HEADER)
      .send({ username: users.admin.username, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/rankit_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('returns the current user and signs out', async () => {
    const agent = await loginAs(app, users.grievance);
    const me = await agent.get('/api/users/me');
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('grievance');

    const out = await agent.post('/api/users/logout');
    expect(out.status).toBe(200);
    expect((await agent.get('/api/users/me')).status).toBe(401);
  });

  it('rejects state-changing requests without the app header', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ username: users.admin.username, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('revokes sessions after a password change', async () => {
    const victim = await createUser('dana', 'tabulator');
    const session = await loginAs(app, victim);
    expect((await session.get('/api/users/me')).status).toBe(200);

    const root = await loginAs(app, users.superadmin);
    const update = await root.put(`/api/users/${victim._id}`).send({ password: 'brand-new-pass' });
    expect(update.status).toBe(200);
    expect((await session.get('/api/users/me')).status).toBe(401);
  });
});

describe('account hierarchy', () => {
  it('stops admins from changing or deleting a superadmin', async () => {
    const admin = await loginAs(app, users.admin);
    const reset = await admin.put(`/api/users/${users.superadmin._id}`).send({ password: 'hijacked-password' });
    expect(reset.status).toBe(403);
    const remove = await admin.delete(`/api/users/${users.superadmin._id}`);
    expect(remove.status).toBe(403);
  });

  it('stops admins from granting the admin role', async () => {
    const admin = await loginAs(app, users.admin);
    const target = await createUser('promo', 'tabulator');
    const promote = await admin.put(`/api/users/${target._id}`).send({ role: 'admin' });
    expect(promote.status).toBe(403);
    const create = await admin.post('/api/users').send({ username: 'newadmin', password: 'long-enough-pw', role: 'admin' });
    expect(create.status).toBe(403);
  });

  it('lets admins manage tabulators and keeps the username format', async () => {
    const admin = await loginAs(app, users.admin);
    const target = await createUser('rename', 'tabulator');
    const res = await admin.put(`/api/users/${target._id}`).send({ username: 'x@superadmin.rankit' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('x@tabulator.rankit');
  });

  it('lets superadmin promote users but not delete itself', async () => {
    const root = await loginAs(app, users.superadmin);
    const target = await createUser('rising', 'tabulator');
    const promote = await root.put(`/api/users/${target._id}`).send({ role: 'admin' });
    expect(promote.status).toBe(200);
    expect(promote.body.role).toBe('admin');
    const self = await root.delete(`/api/users/${users.superadmin._id}`);
    expect(self.status).toBe(400);
  });

  it('rejects repeated eventId query parameters', async () => {
    const tab = await loginAs(app, users.tabulator);
    const id = '0123456789abcdef01234567';
    const res = await tab.get(`/api/contestants?eventId=${id}&eventId=${id}`);
    expect(res.status).toBe(400);
  });
});

describe('role guards', () => {
  it('forbids tabulators from the audit trail', async () => {
    const agent = await loginAs(app, users.tabulator);
    const res = await agent.get('/api/audits');
    expect(res.status).toBe(403);
  });

  it('lets superadmin use admin routes', async () => {
    const agent = await loginAs(app, users.superadmin);
    const res = await agent.get('/api/events');
    expect(res.status).toBe(200);
  });

  it('lets superadmin see and approve pending accounts of any role', async () => {
    const waiting = await createUser('newgriev', 'grievance', { approved: false });
    const root = await loginAs(app, users.superadmin);
    const pending = await root.get('/api/users/pending');
    expect(pending.body.map((user) => user.username)).toContain(waiting.username);
    const res = await root.patch(`/api/users/${waiting._id}/approval`).send({ decision: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body.approvalStatus).toBe('approved');
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
    const res = await admin.post('/api/events').send({ name: 'X', category: 'Nope' });
    expect(res.status).toBe(400);
  });

  it('adds a contestant', async () => {
    const res = await admin
      .post('/api/contestants')
      
      .send({ name: 'Contestant One', eventId, contestantNumber: 1 });
    expect(res.status).toBe(201);
    contestantId = (res.body.contestant || res.body)._id;
  });

  it('records a score from the assigned tabulator', async () => {
    const tab = await loginAs(app, users.tabulator);
    const res = await tab
      .post('/api/scores/record')
      
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
      
      .send({ deductionPoints: 2 });
    expect(missing.status).toBe(400);

    const ok = await griev
      .patch(`/api/contestants/${contestantId}/deduct`)
      
      .send({ deductionPoints: 2, reason: 'Late entrance' });
    expect(ok.status).toBe(200);
  });

  it('exports a backup without password hashes', async () => {
    const res = await admin.get('/api/admin/backup');
    expect(res.status).toBe(200);
    const body = JSON.parse(res.text);
    expect(body.collections.users.length).toBeGreaterThan(0);
    expect(body.collections.users.every((user) => !('password' in user))).toBe(true);
  });

  it('shows saved final results for finalized events', async () => {
    const Event = require('../models/Event');
    await Event.updateOne(
      { _id: eventId },
      {
        eventStatus: 'finalized',
        finalResults: [{ contestantId, contestantNumber: 1, contestantName: 'Official Winner', rank: 1, finalScore: 42 }]
      }
    );
    const res = await request(app).get(`/api/public/leaderboard?eventId=${eventId}`);
    expect(res.status).toBe(200);
    expect(res.body.leaderboard[0]).toMatchObject({ contestantName: 'Official Winner', liveRank: 1 });
  });

  it('serves the public leaderboard without auth', async () => {
    const res = await request(app).get('/api/public/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leaderboard');
  });
});
