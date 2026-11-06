const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const Audit = require('../models/Audit');
const { PROVIDER_NAMES, getProvider, enabledProviders, normalizeProfile } = require('../config/oauth');
const { COOKIE_NAME, signSessionToken, verifySessionToken, setSessionCookie } = require('../utils/authCookie');

const STATE_COOKIE = 'rankit_oauth';
const STATE_AUDIENCE = 'rankit-oauth';
const STATE_TTL_SECONDS = 10 * 60;
const SELF_REGISTER_ROLES = ['tabulator', 'grievance'];

const startQuery = z.object({
  mode: z.enum(['login', 'register', 'link']).default('login'),
  role: z.enum(SELF_REGISTER_ROLES).default('tabulator')
});

const base64url = (buffer) => buffer.toString('base64url');

const stateCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // Lax still sends the cookie on the provider's top-level redirect back to the callback.
  sameSite: 'lax',
  path: '/api/auth'
});

// Redirect targets are fixed app paths plus a code from a closed list, so nothing user-controlled is reflected.
const fail = (res, code, path = '/login') => {
  res.clearCookie(STATE_COOKIE, stateCookieOptions());
  return res.redirect(302, `${path}?oauth_error=${code}`);
};

const audit = async (action, user, metadata) => {
  try {
    await Audit.create({ action, actorId: user._id, entityType: 'user', entityId: user._id, metadata });
  } catch (error) {
    // Logging failures must not block sign-in.
  }
};

const sessionUser = async (req) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = verifySessionToken(token);
    const user = await User.findById(payload.userId);
    if (!user || !user.isApproved || (user.tokenVersion || 0) !== (payload.tv || 0)) return null;
    return user;
  } catch (error) {
    return null;
  }
};

const listProviders = (req, res) => res.json({ providers: enabledProviders() });

const start = async (req, res, next) => {
  try {
    const provider = getProvider(req.params.provider);
    if (!provider) return fail(res, 'disabled');

    const parsed = startQuery.safeParse(req.query);
    if (!parsed.success) return fail(res, 'invalid_request');
    const { mode, role } = parsed.data;

    let uid;
    if (mode === 'link') {
      const user = await sessionUser(req);
      if (!user) return fail(res, 'session_required');
      uid = user._id.toString();
    }

    const state = base64url(crypto.randomBytes(24));
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());

    const stateToken = jwt.sign({ p: provider.name, mode, role, state, verifier, uid }, process.env.JWT_SECRET, {
      expiresIn: STATE_TTL_SECONDS,
      audience: STATE_AUDIENCE,
      algorithm: 'HS256'
    });
    res.cookie(STATE_COOKIE, stateToken, { ...stateCookieOptions(), maxAge: STATE_TTL_SECONDS * 1000 });

    const url = new URL(provider.authorizeUrl);
    url.search = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: provider.scope,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ...provider.extraAuthorizeParams
    }).toString();

    return res.redirect(302, url.toString());
  } catch (error) {
    return next(error);
  }
};

const readState = (req, providerName) => {
  const token = req.cookies?.[STATE_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { audience: STATE_AUDIENCE, algorithms: ['HS256'] });
    const given = Buffer.from(String(req.query.state || ''));
    const expected = Buffer.from(String(payload.state || ''));
    if (payload.p !== providerName || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
};

// Exchanges the code for an access token, uses it once to read the profile, and discards it.
const fetchProfile = async (provider, code, verifier) => {
  const tokenRes = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: provider.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier
    }),
    signal: AbortSignal.timeout(10000)
  });
  const tokenBody = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenBody.access_token) return null;

  const profileRes = await fetch(provider.profileUrl, {
    headers: { Authorization: `Bearer ${tokenBody.access_token}`, Accept: 'application/json', 'User-Agent': 'RankIT' },
    signal: AbortSignal.timeout(10000)
  });
  if (!profileRes.ok) return null;
  return normalizeProfile(provider.name, await profileRes.json());
};

const identityFields = (providerName, profile) =>
  providerName === 'google'
    ? { providerId: profile.providerId, email: profile.email }
    : { providerId: profile.providerId, login: profile.login };

const uniqueUsername = async (nameHint, role) => {
  const base =
    String(nameHint || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 30) || 'user';
  for (let i = 0; i < 50; i += 1) {
    const candidate = `${i === 0 ? base : `${base}${i + 1}`}@${role}.rankit`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `${base}${crypto.randomInt(1000, 9999)}@${role}.rankit`;
};

const signIn = async (res, user, providerName) => {
  if (!user.isApproved) return fail(res, user.approvalStatus === 'rejected' ? 'rejected' : 'pending');
  setSessionCookie(res, signSessionToken(user));
  await audit('USER_OAUTH_LOGGED_IN', user, { username: user.username, role: user.role, provider: providerName });
  // The login page sends signed-in users on to their role's home.
  return res.redirect(302, '/login');
};

const callback = async (req, res, next) => {
  try {
    const provider = getProvider(req.params.provider);
    if (!provider) return fail(res, 'disabled');

    const state = readState(req, provider.name);
    if (!state) return fail(res, 'invalid_state');
    const returnPath = state.mode === 'link' ? '/' : '/login';
    res.clearCookie(STATE_COOKIE, stateCookieOptions());

    if (req.query.error) return fail(res, 'cancelled', returnPath);
    if (typeof req.query.code !== 'string' || !req.query.code) return fail(res, 'invalid_request', returnPath);

    const profile = await fetchProfile(provider, req.query.code, state.verifier);
    if (!profile || !profile.providerId) return fail(res, 'provider_error', returnPath);
    if (!profile.emailVerified) return fail(res, 'unverified_email', returnPath);

    const linkedUser = await User.findOne({ [`oauth.${provider.name}.providerId`]: profile.providerId });

    if (state.mode === 'link') {
      const user = await sessionUser(req);
      if (!user || user._id.toString() !== state.uid) return fail(res, 'session_required', returnPath);
      if (linkedUser && linkedUser._id.toString() !== user._id.toString()) {
        return fail(res, 'linked_elsewhere', returnPath);
      }
      await User.updateOne(
        { _id: user._id },
        { $set: { [`oauth.${provider.name}`]: identityFields(provider.name, profile) } }
      );
      await audit('USER_OAUTH_LINKED', user, { username: user.username, provider: provider.name });
      return res.redirect(302, '/?oauth=linked');
    }

    if (linkedUser) return signIn(res, linkedUser, provider.name);
    if (state.mode === 'login') return fail(res, 'not_linked');

    // Register: same approval flow as password sign-ups, limited to self-service roles.
    const role = SELF_REGISTER_ROLES.includes(state.role) ? state.role : 'tabulator';
    const user = await User.create({
      username: await uniqueUsername(profile.nameHint, role),
      role,
      isApproved: false,
      approvalStatus: 'pending',
      oauth: { [provider.name]: identityFields(provider.name, profile) }
    });
    await audit('USER_OAUTH_REGISTERED', user, {
      username: user.username,
      role,
      provider: provider.name,
      approvalStatus: 'pending'
    });
    return res.redirect(302, `/login?oauth=pending&username=${encodeURIComponent(user.username)}`);
  } catch (error) {
    return next(error);
  }
};

const listLinks = async (req, res) => {
  const user = await User.findById(req.user._id).select('password oauth');
  return res.json({
    hasPassword: Boolean(user?.password),
    providers: enabledProviders().map(({ id, label }) => ({
      id,
      label,
      linked: Boolean(user?.oauth?.[id]?.providerId),
      account: (id === 'google' ? user?.oauth?.google?.email : user?.oauth?.github?.login) || null
    }))
  });
};

const unlink = async (req, res) => {
  const name = req.params.provider;
  if (!PROVIDER_NAMES.includes(name)) return res.status(404).json({ message: 'Unknown provider.' });

  const user = await User.findById(req.user._id).select('password oauth username');
  if (!user?.oauth?.[name]?.providerId) return res.status(404).json({ message: 'That account is not linked.' });

  const hasOtherMethod =
    Boolean(user.password) || PROVIDER_NAMES.some((other) => other !== name && user.oauth?.[other]?.providerId);
  if (!hasOtherMethod) {
    return res
      .status(409)
      .json({ message: 'This is your only sign-in method. Ask an admin to set a password before unlinking it.' });
  }

  await User.updateOne({ _id: user._id }, { $unset: { [`oauth.${name}`]: '' } });
  await audit('USER_OAUTH_UNLINKED', user, { username: user.username, provider: name });
  return res.json({ message: 'Unlinked.' });
};

module.exports = { listProviders, start, callback, listLinks, unlink, STATE_COOKIE };
