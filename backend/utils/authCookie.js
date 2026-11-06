const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'rankit_session';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT secret is not configured.');
  return secret;
};

const signSessionToken = (user) =>
  jwt.sign({ userId: user._id.toString(), tv: user.tokenVersion || 0 }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
    algorithm: 'HS256'
  });

const verifySessionToken = (token) => jwt.verify(token, getSecret(), { algorithms: ['HS256'] });

// Secure cookies need HTTPS, so they are only forced in production; SameSite=Lax keeps
// the cookie off cross-site POST/PATCH/DELETE requests.
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api'
});

const setSessionCookie = (res, token) => {
  const { exp } = jwt.decode(token);
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: Math.max(0, exp * 1000 - Date.now()) });
};

const clearSessionCookie = (res) => res.clearCookie(COOKIE_NAME, cookieOptions());

module.exports = { COOKIE_NAME, signSessionToken, verifySessionToken, setSessionCookie, clearSessionCookie };
