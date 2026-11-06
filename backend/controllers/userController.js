const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Audit = require('../models/Audit');
const { HttpError, sendClientError } = require('../utils/httpErrors');

const PRIVILEGED_ROLES = ['admin', 'superadmin'];

const writeAudit = async ({ action, actorId, entityType, entityId, metadata }) => {
    try {
        await Audit.create({ action, actorId, entityType, entityId, metadata });
    } catch (error) {
        // Logging failures should not block core endpoints.
    }
};

// Role hierarchy for account management: admins manage tabulator and grievance accounts only;
// admin and superadmin accounts (and granting the admin role) are superadmin-only.
const assertCanManage = (actor, { targetRole, nextRole }) => {
    if (actor.role === 'superadmin') return;
    if (PRIVILEGED_ROLES.includes(targetRole) || PRIVILEGED_ROLES.includes(nextRole)) {
        throw new HttpError(403, 'Only a superadmin can manage admin accounts.');
    }
};

const domainUsername = (name, role) => `${String(name).split('@')[0].toLowerCase().trim()}@${role}.rankit`;

const getUsers = async (req, res) => {
    const users = await User.find().select('-password').sort({ username: 1 });
    return res.json(users);
};

const createUser = async (req, res) => {
    try {
        const { username, password, role } = req.body;
        assertCanManage(req.user, { nextRole: role });

        const formatted = domainUsername(username, role);
        const existingUser = await User.findOne({ username: formatted });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists.' });
        }

        const user = await User.create({
            username: formatted,
            password: await bcrypt.hash(password, 12),
            role,
            isApproved: true,
            approvalStatus: 'approved'
        });

        await writeAudit({
            action: 'ADMIN_CREATED_USER',
            actorId: req.user._id,
            entityType: 'user',
            entityId: user._id,
            metadata: { username: user.username, role: user.role, bypassApproval: true, identityFormat: 'domain-based' }
        });

        return res.status(201).json({
            id: user._id,
            username: user.username,
            role: user.role,
            isApproved: user.isApproved,
            approvalStatus: user.approvalStatus
        });
    } catch (error) {
        if (error instanceof HttpError) throw error;
        return sendClientError(res, error);
    }
};

const updateUser = async (req, res) => {
    try {
        const { username, role, password } = req.body;
        const target = await User.findById(req.params.id).select('role username');
        if (!target) {
            return res.status(404).json({ message: 'User not found.' });
        }

        assertCanManage(req.user, { targetRole: target.role, nextRole: role });

        const nextRole = role || target.role;
        const updates = {};
        // Keep the name@role.rankit format whenever the name or role changes.
        if (username || role) updates.username = domainUsername(username || target.username, nextRole);
        if (role) updates.role = role;
        if (password) updates.password = await bcrypt.hash(password, 12);

        // Revoke existing sessions when credentials or permissions change.
        const revokeSessions = Boolean(password || role);

        const updatedUser = await User.findByIdAndUpdate(
            target._id,
            revokeSessions ? { ...updates, $inc: { tokenVersion: 1 } } : updates,
            { new: true, runValidators: true }
        ).select('-password');

        await writeAudit({
            action: 'ADMIN_UPDATED_USER',
            actorId: req.user._id,
            entityType: 'user',
            entityId: updatedUser._id,
            metadata: { updates: { username: updates.username, role, passwordChanged: Boolean(password) } }
        });

        return res.json(updatedUser);
    } catch (error) {
        if (error instanceof HttpError) throw error;
        return sendClientError(res, error);
    }
};

const deleteUser = async (req, res) => {
    const target = await User.findById(req.params.id).select('role username');
    if (!target) {
        return res.status(404).json({ message: 'User not found.' });
    }
    if (String(target._id) === String(req.user._id)) {
        throw new HttpError(400, 'You cannot delete your own account.');
    }
    assertCanManage(req.user, { targetRole: target.role });

    await User.deleteOne({ _id: target._id });

    await writeAudit({
        action: 'ADMIN_DELETED_USER',
        actorId: req.user._id,
        entityType: 'user',
        entityId: target._id,
        metadata: { username: target.username, role: target.role }
    });

    return res.json({ message: 'User deleted successfully.' });
};

module.exports = {
    getUsers,
    createUser,
    updateUser,
    deleteUser
};
