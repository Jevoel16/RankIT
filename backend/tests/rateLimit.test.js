import { afterAll, beforeAll, expect, it } from 'vitest';
import helpers from './helpers';

const { APP_HEADER, startApp, stopApp, createUser, request } = helpers;

let app;
let user;

beforeAll(async () => {
  app = await startApp();
  user = await createUser('target', 'admin');
}, 120000);

afterAll(stopApp);

it('locks out after 5 failed logins', async () => {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await request(app).post('/api/users/login').set(APP_HEADER).send({ username: user.username, password: 'wrong-pass' });
    expect(res.status).toBe(401);
  }

  const blocked = await request(app).post('/api/users/login').set(APP_HEADER).send({ username: user.username, password: 'wrong-pass' });
  expect(blocked.status).toBe(429);
});
