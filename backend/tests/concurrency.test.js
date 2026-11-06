import { afterAll, beforeAll, expect, it } from 'vitest';
import helpers from './helpers';

const { startApp, stopApp, request } = helpers;

let app;

beforeAll(async () => {
  app = await startApp();
  // Build the unique index first, as in a real database, so duplicate creates collide.
  await require('../models/CommunityAccess').init();
}, 120000);

afterAll(stopApp);

it('handles concurrent first loads of the public leaderboard', async () => {
  const responses = await Promise.all(
    Array.from({ length: 6 }, () => request(app).get('/api/public/leaderboard'))
  );
  expect(responses.map((res) => res.status)).toEqual(Array(6).fill(200));
});
