const bcrypt = require('bcryptjs');
const { signSessionToken, setSessionCookie, clearSessionCookie } = require('../utils/authCookie');
const User = require('../models/User');
const Audit = require('../models/Audit');

const writeAudit = async ({ action, actorId, entityType, entityId, metadata }) => {
  try {
    await Audit.create({ action, actorId, entityType, entityId, metadata });
  } catch (error) {
    // Logging failures should not block core endpoints.
  }
};

// Accounts are created only through Google/GitHub sign-in; this is the alternative
// username + password sign-in for accounts that finished the password step.
const loginUser = async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username: username.toLowerCase().trim() });

  // Accounts that never set a password have nothing to compare against.
  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  if (user.disabled) {
    return res.status(403).json({ message: 'Account disabled. Contact an admin.' });
  }
  if (user.role === 'pending') {
    return res.status(403).json({ message: 'Waiting for an admin to assign your role.' });
  }

  setSessionCookie(res, signSessionToken(user));

  await writeAudit({
    action: 'USER_LOGGED_IN',
    actorId: user._id,
    entityType: 'user',
    entityId: user._id,
    metadata: { username: user.username, role: user.role }
  });

  return res.json({ user: { id: user._id, username: user.username, role: user.role } });
};

const logoutUser = (req, res) => {
  clearSessionCookie(res);
  return res.json({ message: 'Signed out.' });
};

const getCurrentUser = (req, res) =>
  res.json({ user: { id: req.user._id, username: req.user.username, role: req.user.role } });

module.exports = { loginUser, logoutUser, getCurrentUser };
