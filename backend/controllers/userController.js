const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Audit = require('../models/Audit');
const { HttpError } = require('../utils/httpErrors');

const PROTECTED_ROLES = ['admin', 'superadmin'];

const writeAudit = async ({ action, actorId, entityId, metadata }) => {
  try {
    await Audit.create({ action, actorId, entityType: 'user', entityId, metadata });
  } catch (error) {
    // Logging failures should not block core endpoints.
  }
};

// Safe fields for the admin console: no hash, provider ids or token versions.
const publicUser = (user) => ({
  _id: user._id,
  username: user.username,
  role: user.role,
  disabled: Boolean(user.disabled),
  hasPassword: Boolean(user.password),
  providers: ['google', 'github'].filter((name) => user.oauth?.[name]?.providerId),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

// Admins manage everyone except themselves, other admins and the superadmin.
// Fixing an admin account is the superadmin's recovery job.
const findManageable = async (req) => {
  const target = await User.findById(req.params.id);
  if (!target) throw new HttpError(404, 'User not found.');
  if (String(target._id) === String(req.user._id)) throw new HttpError(400, 'You cannot change your own account.');
  if (PROTECTED_ROLES.includes(target.role)) {
    throw new HttpError(403, 'Admin accounts can only be recovered by the superadmin.');
  }
  return target;
};

const getUsers = async (req, res) => {
  const users = await User.find({ role: { $ne: 'superadmin' } }).sort({ role: 1, username: 1 });
  return res.json(users.map(publicUser));
};

const assignRole = async (req, res) => {
  const target = await findManageable(req);
  const { role } = req.body;

  const updated = await User.findByIdAndUpdate(
    target._id,
    { $set: { role }, $inc: { tokenVersion: 1 } },
    { returnDocument: 'after', runValidators: true }
  );

  await writeAudit({
    action: 'ADMIN_ASSIGNED_ROLE',
    actorId: req.user._id,
    entityId: target._id,
    metadata: { username: target.username, from: target.role, to: role }
  });

  return res.json(publicUser(updated));
};

const setStatus = async (req, res) => {
  const target = await findManageable(req);
  const { disabled } = req.body;

  const updated = await User.findByIdAndUpdate(
    target._id,
    { $set: { disabled }, $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' }
  );

  await writeAudit({
    action: disabled ? 'ADMIN_DISABLED_USER' : 'ADMIN_ENABLED_USER',
    actorId: req.user._id,
    entityId: target._id,
    metadata: { username: target.username, role: target.role }
  });

  return res.json(publicUser(updated));
};

const resetPassword = async (req, res) => {
  const target = await findManageable(req);

  const updated = await User.findByIdAndUpdate(
    target._id,
    { $set: { password: await bcrypt.hash(req.body.password, 12) }, $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' }
  );

  await writeAudit({
    action: 'ADMIN_RESET_PASSWORD',
    actorId: req.user._id,
    entityId: target._id,
    metadata: { username: target.username, role: target.role }
  });

  return res.json(publicUser(updated));
};

const deleteUser = async (req, res) => {
  const target = await findManageable(req);

  await User.deleteOne({ _id: target._id });

  await writeAudit({
    action: 'ADMIN_DELETED_USER',
    actorId: req.user._id,
    entityId: target._id,
    metadata: { username: target.username, role: target.role }
  });

  return res.json({ message: 'User deleted.' });
};

module.exports = { getUsers, assignRole, setStatus, resetPassword, deleteUser, publicUser };
