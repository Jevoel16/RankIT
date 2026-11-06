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

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: json('Too many registrations from this network. Try again later.')
});

module.exports = { apiLimiter, loginLimiter, registerLimiter };
