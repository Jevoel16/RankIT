// Google and GitHub OAuth providers. A provider is enabled only when its client id and secret are set
// and the public app URL is known (redirect URIs must match what is registered with the provider).
const PROVIDERS = {
  google: {
    label: 'Google',
    env: 'GOOGLE',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    extraAuthorizeParams: { prompt: 'select_account' }
  },
  github: {
    label: 'GitHub',
    env: 'GITHUB',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    profileUrl: 'https://api.github.com/user',
    scope: 'read:user',
    extraAuthorizeParams: { allow_signup: 'false' }
  }
};

const PROVIDER_NAMES = Object.keys(PROVIDERS);

const appUrl = () => {
  const explicit = String(process.env.APP_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (explicit) return explicit;
  // Vercel sets this on every deployment; it points at the production domain.
  const vercel = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  return vercel ? `https://${vercel}` : '';
};

const getProvider = (name) => {
  if (!Object.hasOwn(PROVIDERS, name)) return null;
  const base = PROVIDERS[name];
  const clientId = process.env[`${base.env}_CLIENT_ID`];
  const clientSecret = process.env[`${base.env}_CLIENT_SECRET`];
  const origin = appUrl();
  if (!clientId || !clientSecret || !origin) return null;
  return { name, ...base, clientId, clientSecret, redirectUri: `${origin}/api/auth/${name}/callback` };
};

const enabledProviders = () =>
  PROVIDER_NAMES.filter((name) => getProvider(name)).map((name) => ({ id: name, label: PROVIDERS[name].label }));

// Reduces a provider profile to the few fields RankIT keeps.
const normalizeProfile = (name, data) => {
  if (name === 'google') {
    const email = typeof data.email === 'string' ? data.email.toLowerCase() : '';
    return {
      providerId: data.sub ? String(data.sub) : '',
      email,
      emailVerified: data.email_verified === true || data.email_verified === 'true',
      nameHint: email.split('@')[0]
    };
  }
  const login = typeof data.login === 'string' ? data.login : '';
  // GitHub accounts are identified by numeric id; email isn't requested.
  return { providerId: data.id ? String(data.id) : '', login, emailVerified: true, nameHint: login };
};

module.exports = { PROVIDER_NAMES, getProvider, enabledProviders, normalizeProfile };
