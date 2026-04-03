const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Event = require('../models/Event');

const resolveEventId = (req, source) => {
  if (source === 'params') {
    return req.params.eventId || req.params.id;
  }

  if (source === 'query') {
    return req.query.eventId || req.query.id;
  }

  return req.body.eventId || req.body.id;
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid authorization header.' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      return res.status(500).json({ message: 'JWT secret is not configured.' });
    }

    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User for token no longer exists.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized request.' });
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions.' });
    }

    next();
  };
};

const authorizeEventAssignment = ({
  eventIdSource = 'params',
  allowAdminRoles = ['admin', 'superadmin'],
  allowedAssignedRoles = ['tabulator']
} = {}) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized request.' });
      }

      if (allowAdminRoles.includes(req.user.role)) {
        return next();
      }

      if (!allowedAssignedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden: insufficient permissions.' });
      }

      const eventId = resolveEventId(req, eventIdSource);
      if (!eventId) {
        return res.status(400).json({ message: 'eventId is required for assignment validation.' });
      }

      const event = await Event.findById(eventId).select('tabulatorId assignedTallierIds');
      if (!event) {
        return res.status(404).json({ message: 'Event not found.' });
      }

      const userId = req.user._id.toString();
      const isAssignedTabulator =
        req.user.role === 'tabulator' && event.tabulatorId && event.tabulatorId.toString() === userId;
      if (!isAssignedTabulator) {
        return res.status(403).json({ message: 'Forbidden: not assigned to this event.' });
      }

      req.eventAccess = { eventId, event };
      return next();
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizeEventAssignment
};