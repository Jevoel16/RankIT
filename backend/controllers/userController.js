const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Audit = require('../models/Audit');

const createToken = (userId) => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT secret is not configured.');
    }

    return jwt.sign(
        { userId },
        secret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );
};

const writeAudit = async ({ action, actorId, entityType, entityId, metadata }) => {
    try {
        await Audit.create({ action, actorId, entityType, entityId, metadata });
    } catch (error) {
        // Logging failures should not block core endpoints.
    }
};

const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'username and password are required.' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = createToken(user._id.toString());

        return res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ username: 1 });
        return res.json(users);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const createUser = async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({ message: 'username, password, and role are required.' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            password: hashedPassword,
            role,
            isApproved: true,
            approvalStatus: 'approved'
        });

        await writeAudit({
            action: 'ADMIN_CREATED_USER',
            actorId: req.user._id,
            entityType: 'user',
            entityId: user._id,
            metadata: { username: user.username, role: user.role, bypassApproval: true }
        });

        return res.status(201).json({
            id: user._id,
            username: user.username,
            role: user.role,
            isApproved: user.isApproved,
            approvalStatus: user.approvalStatus
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const { username, role, password } = req.body;
        const updates = {};

        if (username) updates.username = username;
        if (role) updates.role = role;
        if (password) {
            updates.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true
        }).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await writeAudit({
            action: 'ADMIN_UPDATED_USER',
            actorId: req.user._id,
            entityType: 'user',
            entityId: updatedUser._id,
            metadata: { updates: { username, role, passwordChanged: Boolean(password) } }
        });

        return res.json(updatedUser);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await writeAudit({
            action: 'ADMIN_DELETED_USER',
            actorId: req.user._id,
            entityType: 'user',
            entityId: user._id,
            metadata: { username: user.username, role: user.role }
        });

        return res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    loginUser,
    getUsers,
    createUser,
    updateUser,
    deleteUser
};
