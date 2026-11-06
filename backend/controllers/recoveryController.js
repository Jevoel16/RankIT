// Superadmin's only job: recovering admin access. It can promote an account to admin
// (e.g. when no admin is left) and reset an admin's password. Nothing else.
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Audit = require('../models/Audit');
const { HttpError } = require('../utils/httpErrors');
const { publicUser } = require('./userController');

const writeAudit = async ({ action, actorId, entityId, metadata }) => {
  try {
    await Audit.create({ action, actorId, entityType: 'user', entityId, metadata });
  } catch (error) {
    // Logging failures should not block core endpoints.
  }
};

const findTarget = async (id) => {
  const target = await User.findById(id);
  if (!target || target.role === 'superadmin') throw new HttpError(404, 'User not found.');
  return target;
};

const listAccounts = async (req, res) => {
  const users = await User.find({ role: { $ne: 'superadmin' } }).sort({ role: 1, username: 1 });
  return res.json(users.map(publicUser));
};

const promoteToAdmin = async (req, res) => {
  const target = await findTarget(req.params.id);
  if (!target.password) {
    throw new HttpError(409, 'This account has not finished setting its password yet.');
  }

  const updated = await User.findByIdAndUpdate(
    target._id,
    { $set: { role: 'admin', disabled: false }, $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' }
  );

  await writeAudit({
    action: 'SUPERADMIN_PROMOTED_ADMIN',
    actorId: req.user._id,
    entityId: target._id,
    metadata: { username: target.username, from: target.role }
  });

  return res.json(publicUser(updated));
};

const resetAdminPassword = async (req, res) => {
  const target = await findTarget(req.params.id);
  if (target.role !== 'admin') throw new HttpError(403, 'Only admin passwords can be reset here.');

  const updated = await User.findByIdAndUpdate(
    target._id,
    { $set: { password: await bcrypt.hash(req.body.password, 12), disabled: false }, $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' }
  );

  await writeAudit({
    action: 'SUPERADMIN_RESET_ADMIN_PASSWORD',
    actorId: req.user._id,
    entityId: target._id,
    metadata: { username: target.username }
  });

  return res.json(publicUser(updated));
};

module.exports = { listAccounts, promoteToAdmin, resetAdminPassword };
