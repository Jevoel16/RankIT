const { rateLimit } = require('express-rate-limit');

// In-memory counters are per instance; on Vercel each warm function keeps its own,
// so these limits are a floor, not an exact global cap.
const json = (message) => (req, res) => res.status(429).json({ message });

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: json('Too many requests. Please slow down.')
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: json('Too many login attempts. Try again in 15 minutes.')
});

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: json('Too many attempts from this network. Try again later.')
});

// OAuth start/callback answer with redirects (never 4xx), so every request counts.
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: json('Too many sign-in attempts. Try again in 15 minutes.')
});

module.exports = { apiLimiter, loginLimiter, setupLimiter, oauthLimiter };
