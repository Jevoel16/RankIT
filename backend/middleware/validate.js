const { z } = require('zod');

// Validates and replaces req.body with the parsed value, so unknown keys are stripped
// before they reach Mongoose (prevents mass assignment).
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join('.');
    return res.status(400).json({ message: field ? `${field}: ${issue.message}` : issue.message });
  }
  req.body = result.data;
  return next();
};

// Rejects Mongo operator keys ($gt, $ne, ...) anywhere in the JSON body.
const hasOperatorKey = (value, depth = 0) => {
  if (depth > 20 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => hasOperatorKey(item, depth + 1));
  return Object.keys(value).some((key) => key.startsWith('$') || hasOperatorKey(value[key], depth + 1));
};

const rejectOperatorKeys = (req, res, next) => {
  if (hasOperatorKey(req.body)) {
    return res.status(400).json({ message: 'Invalid characters in request body.' });
  }
  return next();
};

module.exports = { z, validateBody, rejectOperatorKeys };
