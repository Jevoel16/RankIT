// Messages from our own `new Error(...)` and Mongoose validation are safe to show;
// driver/server errors can leak collection or index details, so they get a generic text.
const isDuplicateKey = (error) => error?.code === 11000;

const clientMessage = (error) => {
  if (isDuplicateKey(error)) return 'A record with the same unique value already exists.';
  if (error?.name === 'CastError') return 'Invalid identifier.';
  if (error?.name === 'ValidationError') return error.message;
  if (error?.name === 'Error' && error.code === undefined) return error.message;
  return 'Request could not be processed.';
};

const sendClientError = (res, error, status = 400) =>
  res.status(isDuplicateKey(error) ? 409 : status).json({ message: clientMessage(error) });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// Central Express error handler; logs server-side and never returns stack traces.
const errorHandler = (error, req, res, next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body.' });
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.' });
  }

  if (error?.name === 'CastError' || error?.name === 'ValidationError' || isDuplicateKey(error)) {
    return sendClientError(res, error);
  }

  if (error?.name === 'MongooseServerSelectionError' || error?.code === 'DB_UNAVAILABLE') {
    console.error('[db]', error.message);
    return res.status(503).json({ message: 'Database is unavailable. Please try again shortly.' });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}:`, error?.stack || error);
  return res.status(500).json({ message: 'Internal server error.' });
};

const notFoundHandler = (req, res) => res.status(404).json({ message: 'Route not found.' });

module.exports = { HttpError, sendClientError, errorHandler, notFoundHandler };
