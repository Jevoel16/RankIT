// CORS_ORIGIN is a comma-separated allow-list. In development any origin is reflected so
// LAN devices (http://<lan-ip>:3000) keep working; in production the list is required.
const allowedOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    // Same-origin and server-to-server requests have no Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (!isProduction && allowedOrigins.length === 0) return callback(null, true);
    return callback(null, false);
  }
};

module.exports = corsOptions;
