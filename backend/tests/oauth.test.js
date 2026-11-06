import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import helpers from './helpers';

const { APP_HEADER, startApp, stopApp, createUser, loginAs, request } = helpers;

let app;
let User;

beforeAll(async () => {
  Object.assign(process.env, {
    APP_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GITHUB_CLIENT_ID: 'github-id',
    GITHUB_CLIENT_SECRET: 'github-secret'
  });
  app = await startApp();
  User = require('../models/User');
  await User.init();
}, 120000);

afterEach(() => vi.unstubAllGlobals());
afterAll(stopApp);

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

// Stubs the provider: token exchange succeeds, the profile endpoint returns `profile`.
const mockProvider = (profile) => {
  const fetchMock = vi.fn(async (url) =>
    String(url).includes('token') ? jsonResponse({ access_token: 'provider-token' }) : jsonResponse(profile)
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

// Runs start → callback on one agent and returns the callback response.
const runFlow = async (agent, provider, query) => {
  const startRes = await agent.get(`/api/auth/${provider}/start`).query(query);
  expect(startRes.status).toBe(302);
  const state = new URL(startRes.headers.location).searchParams.get('state');
  return agent.get(`/api/auth/${provider}/callback`).query({ code: 'auth-code', state });
};

describe('oauth providers', () => {
  it('lists enabled providers', async () => {
    const res = await request(app).get('/api/auth/providers');
    expect(res.body.providers.map((p) => p.id)).toEqual(['google', 'github']);
  });

  it('redirects to the provider with state and PKCE', async () => {
    const res = await request(app).get('/api/auth/google/start');
    const url = new URL(res.headers.location);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/google/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(res.headers['set-cookie'].join(';')).toMatch(/rankit_oauth=.*HttpOnly/);
  });

  it('rejects unknown providers and the removed register mode', async () => {
    const unknown = await request(app).get('/api/auth/facebook/start');
    expect(unknown.headers.location).toBe('/login?oauth_error=disabled');
    const register = await request(app).get('/api/auth/google/start').query({ mode: 'register' });
    expect(register.headers.location).toBe('/login?oauth_error=invalid_request');
  });

  it('rejects a callback whose state does not match', async () => {
    const agent = request.agent(app);
    await agent.get('/api/auth/google/start');
    const res = await agent.get('/api/auth/google/callback').query({ code: 'x', state: 'forged' });
    expect(res.headers.location).toBe('/login?oauth_error=invalid_state');
  });
});

describe('oauth sign-up and sign-in', () => {
  const setupAgent = () => request.agent(app).set(APP_HEADER);

  it('creates a pending account on first sign-in and asks for a password', async () => {
    mockProvider({ sub: 'g-100', email: 'Ana.Cruz@example.com', email_verified: true });
    const agent = setupAgent();
    const res = await runFlow(agent, 'google', {});
    expect(res.headers.location).toBe('/setup-password');
    expect(res.headers['set-cookie'].join(';')).toMatch(/rankit_setup=.*HttpOnly/);
    expect(res.headers['set-cookie'].join(';')).not.toMatch(/rankit_session=/);

    const user = await User.findOne({ 'oauth.google.providerId': 'g-100' });
    expect(user).toMatchObject({ username: 'ana.cruz', role: 'pending' });
    expect(user.password).toBeUndefined();

    const setup = await agent.get('/api/auth/setup');
    expect(setup.body.username).toBe('ana.cruz');

    const mismatch = await agent
      .post('/api/auth/setup-password')
      .send({ password: 'long-enough-1', confirmPassword: 'other' });
    expect(mismatch.status).toBe(400);

    const done = await agent
      .post('/api/auth/setup-password')
      .send({ password: 'long-enough-1', confirmPassword: 'long-enough-1' });
    expect(done.body).toMatchObject({ status: 'pending', username: 'ana.cruz' });
    expect((await agent.get('/api/users/me')).status).toBe(401);

    // The setup step is one-time.
    const again = await agent
      .post('/api/auth/setup-password')
      .send({ password: 'hijack-pass-1', confirmPassword: 'hijack-pass-1' });
    expect(again.status).toBe(401);
  });

  it('refuses the setup step without an OAuth sign-in', async () => {
    const res = await setupAgent()
      .post('/api/auth/setup-password')
      .send({ password: 'long-enough-1', confirmPassword: 'long-enough-1' });
    expect(res.status).toBe(401);
  });

  it('keeps pending accounts out until an admin assigns a role', async () => {
    mockProvider({ sub: 'g-100', email: 'ana.cruz@example.com', email_verified: true });
    const res = await runFlow(setupAgent(), 'google', {});
    expect(res.headers.location).toBe('/login?oauth=pending&username=ana.cruz');

    const password = await request(app)
      .post('/api/users/login')
      .set(APP_HEADER)
      .send({ username: 'ana.cruz', password: 'long-enough-1' });
    expect(password.status).toBe(403);
  });

  it('signs in with OAuth or password once a role is assigned', async () => {
    await User.updateOne({ username: 'ana.cruz' }, { role: 'grievance' });
    mockProvider({ sub: 'g-100', email: 'ana.cruz@example.com', email_verified: true });
    const agent = setupAgent();
    const res = await runFlow(agent, 'google', {});
    expect(res.headers.location).toBe('/login');
    expect((await agent.get('/api/users/me')).body.user).toMatchObject({ username: 'ana.cruz', role: 'grievance' });

    const password = await request(app)
      .post('/api/users/login')
      .set(APP_HEADER)
      .send({ username: 'ana.cruz', password: 'long-enough-1' });
    expect(password.status).toBe(200);
  });

  it('uses the GitHub login as username and adds a number on clashes', async () => {
    await createUser('octo', 'tabulator');
    mockProvider({ id: 555, login: 'Octo' });
    const res = await runFlow(setupAgent(), 'github', {});
    expect(res.headers.location).toBe('/setup-password');
    const user = await User.findOne({ 'oauth.github.providerId': '555' });
    expect(user.username).toBe('octo2');
  });

  it('blocks disabled accounts', async () => {
    await User.updateOne({ 'oauth.github.providerId': '555' }, { disabled: true });
    mockProvider({ id: 555, login: 'Octo' });
    const res = await runFlow(setupAgent(), 'github', {});
    expect(res.headers.location).toBe('/login?oauth_error=disabled');
  });

  it('refuses Google accounts without a verified email', async () => {
    mockProvider({ sub: 'g-200', email: 'x@example.com', email_verified: false });
    const res = await runFlow(setupAgent(), 'google', {});
    expect(res.headers.location).toBe('/login?oauth_error=unverified_email');
    expect(await User.exists({ 'oauth.google.providerId': 'g-200' })).toBeNull();
  });
});

describe('linking accounts', () => {
  it('requires a session to link', async () => {
    const res = await request(app).get('/api/auth/github/start').query({ mode: 'link' });
    expect(res.headers.location).toBe('/login?oauth_error=session_required');
  });

  it('links GitHub to an existing admin, then signs in with it', async () => {
    const admin = await createUser('linker', 'admin');
    const agent = await loginAs(app, admin);
    mockProvider({ id: 42, login: 'linker-gh' });
    const res = await runFlow(agent, 'github', { mode: 'link' });
    expect(res.headers.location).toBe('/?oauth=linked');

    const links = await agent.get('/api/auth/links');
    expect(links.body.providers.find((p) => p.id === 'github')).toMatchObject({ linked: true, account: 'linker-gh' });

    mockProvider({ id: 42, login: 'linker-gh' });
    const signIn = await runFlow(request.agent(app), 'github', {});
    expect(signIn.headers.location).toBe('/login');
  });

  it('will not link an identity that belongs to someone else', async () => {
    const other = await createUser('other', 'tabulator');
    const agent = await loginAs(app, other);
    mockProvider({ id: 42, login: 'linker-gh' });
    const res = await runFlow(agent, 'github', { mode: 'link' });
    expect(res.headers.location).toBe('/?oauth_error=linked_elsewhere');
  });

  // Active accounts always have a password, so an OAuth link can be removed.
  it('unlinks a provider', async () => {
    const admin = await User.findOne({ 'oauth.github.providerId': '42' });
    const agent = await loginAs(app, admin);
    const unlinked = await agent.delete('/api/auth/github/link');
    expect(unlinked.status).toBe(200);
    const again = await agent.delete('/api/auth/github/link');
    expect(again.status).toBe(404);
  });
});
