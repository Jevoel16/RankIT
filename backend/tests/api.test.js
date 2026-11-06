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
    pending: await createUser('phil', 'pending')
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
  it('logs in a user with a role', async () => {
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

  it('blocks disabled accounts', async () => {
    const off = await createUser('off', 'tabulator', { disabled: true });
    const res = await request(app).post('/api/users/login').set(APP_HEADER).send({ username: off.username, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('has no password registration or direct account creation', async () => {
    const register = await request(app)
      .post('/api/users/register')
      .set(APP_HEADER)
      .send({ username: 'newbie', password: 'long-enough-pw' });
    expect(register.status).toBe(404);

    const admin = await loginAs(app, users.admin);
    const create = await admin.post('/api/users').send({ username: 'x', password: 'long-enough-pw', role: 'tabulator' });
    expect(create.status).toBe(404);
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

    const admin = await loginAs(app, users.admin);
    const update = await admin.put(`/api/users/${victim._id}/password`).send({ password: 'brand-new-pass' });
    expect(update.status).toBe(200);
    expect((await session.get('/api/users/me')).status).toBe(401);
  });

  it('revokes sessions after a role change', async () => {
    const victim = await createUser('ellis', 'tabulator');
    const session = await loginAs(app, victim);
    const admin = await loginAs(app, users.admin);
    const update = await admin.patch(`/api/users/${victim._id}/role`).send({ role: 'grievance' });
    expect(update.status).toBe(200);
    expect((await session.get('/api/users/me')).status).toBe(401);
  });
});

describe('admin user management', () => {
  it('lists users without hashes or the superadmin', async () => {
    const admin = await loginAs(app, users.admin);
    const res = await admin.get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.some((user) => user.role === 'superadmin')).toBe(false);
    expect(res.body.every((user) => !('password' in user))).toBe(true);
    expect(res.body.find((user) => user.username === 'phil')).toMatchObject({ role: 'pending', hasPassword: true });
  });

  it('assigns a role to a new sign-up, including admin', async () => {
    const admin = await loginAs(app, users.admin);
    const fresh = await createUser('newbie', 'pending');
    const res = await admin.patch(`/api/users/${fresh._id}/role`).send({ role: 'tabulator' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('tabulator');
    await loginAs(app, fresh);

    const promoted = await createUser('rising', 'tabulator');
    const toAdmin = await admin.patch(`/api/users/${promoted._id}/role`).send({ role: 'admin' });
    expect(toAdmin.body.role).toBe('admin');

    const superRole = await admin.patch(`/api/users/${fresh._id}/role`).send({ role: 'superadmin' });
    expect(superRole.status).toBe(400);
  });

  it('rejects a sign-up by disabling it, and can enable it again', async () => {
    const admin = await loginAs(app, users.admin);
    const target = await createUser('nope', 'pending');
    const off = await admin.patch(`/api/users/${target._id}/status`).send({ disabled: true });
    expect(off.body.disabled).toBe(true);
    const on = await admin.patch(`/api/users/${target._id}/status`).send({ disabled: false });
    expect(on.body.disabled).toBe(false);
  });

  it('stops admins from touching admins, the superadmin or themselves', async () => {
    const admin = await loginAs(app, users.admin);
    const other = await createUser('peer', 'admin');
    for (const target of [other, users.superadmin, users.admin]) {
      const reset = await admin.put(`/api/users/${target._id}/password`).send({ password: 'hijacked-password' });
      expect([400, 403]).toContain(reset.status);
      const demote = await admin.patch(`/api/users/${target._id}/role`).send({ role: 'tabulator' });
      expect([400, 403]).toContain(demote.status);
      const remove = await admin.delete(`/api/users/${target._id}`);
      expect([400, 403]).toContain(remove.status);
    }
  });

  it('forbids non-admins from managing users', async () => {
    const tab = await loginAs(app, users.tabulator);
    expect((await tab.get('/api/users')).status).toBe(403);
  });

  it('rejects repeated eventId query parameters', async () => {
    const tab = await loginAs(app, users.tabulator);
    const id = '0123456789abcdef01234567';
    const res = await tab.get(`/api/contestants?eventId=${id}&eventId=${id}`);
    expect(res.status).toBe(400);
  });
});

describe('superadmin recovery', () => {
  it('is limited to recovery routes', async () => {
    const root = await loginAs(app, users.superadmin);
    for (const path of ['/api/events', '/api/users', '/api/audits', '/api/analytics/overview', '/api/admin/backup']) {
      expect((await root.get(path)).status).toBe(403);
    }
    expect((await root.get('/api/recovery/accounts')).status).toBe(200);
  });

  it('promotes a user to admin', async () => {
    const root = await loginAs(app, users.superadmin);
    const target = await createUser('heir', 'tabulator');
    const res = await root.patch(`/api/recovery/${target._id}/promote`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('resets an admin password but nobody else', async () => {
    const root = await loginAs(app, users.superadmin);
    const locked = await createUser('locked', 'admin');
    const res = await root.put(`/api/recovery/${locked._id}/password`).send({ password: 'recovered-pass-1' });
    expect(res.status).toBe(200);
    const login = await request(app)
      .post('/api/users/login')
      .set(APP_HEADER)
      .send({ username: 'locked', password: 'recovered-pass-1' });
    expect(login.status).toBe(200);

    const tab = await root.put(`/api/recovery/${users.tabulator._id}/password`).send({ password: 'recovered-pass-1' });
    expect(tab.status).toBe(403);
  });

  it('is closed to admins', async () => {
    const admin = await loginAs(app, users.admin);
    expect((await admin.get('/api/recovery/accounts')).status).toBe(403);
  });
});

describe('role guards', () => {
  it('forbids tabulators from the audit trail', async () => {
    const agent = await loginAs(app, users.tabulator);
    const res = await agent.get('/api/audits');
    expect(res.status).toBe(403);
  });

  it('gives admins the audit trail and analytics', async () => {
    const agent = await loginAs(app, users.admin);
    expect((await agent.get('/api/audits')).status).toBe(200);
    expect((await agent.get('/api/analytics/overview')).status).toBe(200);
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
