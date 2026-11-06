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

  it('rejects unknown providers and invalid roles', async () => {
    const unknown = await request(app).get('/api/auth/facebook/start');
    expect(unknown.headers.location).toBe('/login?oauth_error=disabled');
    const admin = await request(app).get('/api/auth/google/start').query({ mode: 'register', role: 'admin' });
    expect(admin.headers.location).toBe('/login?oauth_error=invalid_request');
  });

  it('rejects a callback whose state does not match', async () => {
    const agent = request.agent(app);
    await agent.get('/api/auth/google/start');
    const res = await agent.get('/api/auth/google/callback').query({ code: 'x', state: 'forged' });
    expect(res.headers.location).toBe('/login?oauth_error=invalid_state');
  });
});

describe('oauth sign-up and sign-in', () => {
  it('registers a pending account and refuses sign-in until approved', async () => {
    mockProvider({ sub: 'g-100', email: 'Ana.Cruz@example.com', email_verified: true });
    const res = await runFlow(request.agent(app), 'google', { mode: 'register', role: 'grievance' });
    expect(res.headers.location).toBe('/login?oauth=pending&username=ana.cruz%40grievance.rankit');

    const user = await User.findOne({ 'oauth.google.providerId': 'g-100' });
    expect(user.approvalStatus).toBe('pending');
    expect(user.password).toBeUndefined();

    const again = await runFlow(request.agent(app), 'google', { mode: 'login' });
    expect(again.headers.location).toBe('/login?oauth_error=pending');
  });

  it('signs in an approved linked account with a session cookie', async () => {
    await User.updateOne({ 'oauth.google.providerId': 'g-100' }, { isApproved: true, approvalStatus: 'approved' });
    mockProvider({ sub: 'g-100', email: 'ana.cruz@example.com', email_verified: true });
    const agent = request.agent(app);
    const res = await runFlow(agent, 'google', { mode: 'login' });
    expect(res.headers.location).toBe('/login');
    const me = await agent.get('/api/users/me');
    expect(me.body.user.username).toBe('ana.cruz@grievance.rankit');
  });

  it('does not let an OAuth-only account sign in with a blank password', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .set(APP_HEADER)
      .send({ username: 'ana.cruz@grievance.rankit', password: 'anything' });
    expect(res.status).toBe(401);
  });

  it('refuses sign-in for an identity that is not linked', async () => {
    mockProvider({ id: 555, login: 'stranger' });
    const res = await runFlow(request.agent(app), 'github', { mode: 'login' });
    expect(res.headers.location).toBe('/login?oauth_error=not_linked');
  });

  it('refuses Google accounts without a verified email', async () => {
    mockProvider({ sub: 'g-200', email: 'x@example.com', email_verified: false });
    const res = await runFlow(request.agent(app), 'google', { mode: 'register' });
    expect(res.headers.location).toBe('/login?oauth_error=unverified_email');
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
    const signIn = await runFlow(request.agent(app), 'github', { mode: 'login' });
    expect(signIn.headers.location).toBe('/login');
  });

  it('will not link an identity that belongs to someone else', async () => {
    const other = await createUser('other', 'tabulator');
    const agent = await loginAs(app, other);
    mockProvider({ id: 42, login: 'linker-gh' });
    const res = await runFlow(agent, 'github', { mode: 'link' });
    expect(res.headers.location).toBe('/?oauth_error=linked_elsewhere');
  });

  it('unlinks only while another sign-in method remains', async () => {
    const admin = await User.findOne({ 'oauth.github.providerId': '42' });
    const agent = await loginAs(app, admin);
    const unlinked = await agent.delete('/api/auth/github/link');
    expect(unlinked.status).toBe(200);

    // The OAuth-only account cannot drop its only method.
    mockProvider({ sub: 'g-100', email: 'ana.cruz@example.com', email_verified: true });
    const anaAgent = request.agent(app).set(APP_HEADER);
    await runFlow(anaAgent, 'google', { mode: 'login' });
    const refused = await anaAgent.delete('/api/auth/google/link');
    expect(refused.status).toBe(409);
  });
});
