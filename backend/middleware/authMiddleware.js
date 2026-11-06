const { COOKIE_NAME, verifySessionToken, clearSessionCookie } = require('../utils/authCookie');
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
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({ message: 'Not signed in.' });
    }

    const payload = verifySessionToken(token);
    const user = await User.findById(payload.userId).select('-password');

    // A password or role change bumps tokenVersion and revokes older sessions.
    if (!user || !user.isApproved || (user.tokenVersion || 0) !== (payload.tv || 0)) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized request.' });
  }
};

// Superadmin inherits every route that admins can use.
const authorize = (...roles) => {
  const allowedRoles = roles.includes('admin') && !roles.includes('superadmin') ? [...roles, 'superadmin'] : roles;

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
      return next(error);
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizeEventAssignment
};