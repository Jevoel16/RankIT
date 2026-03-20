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

const registerUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required.' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const allowedSelfRegisterRoles = ['tallier', 'tabulator'];
    const requestedRole = role || 'tallier';

    if (!allowedSelfRegisterRoles.includes(requestedRole)) {
      return res.status(403).json({
        message: 'Only tallier and tabulator roles can register directly. Admin accounts are created by superadmin.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      role: requestedRole,
      isApproved: false,
      approvalStatus: 'pending'
    });

    return res.status(201).json({
      message: 'Registration submitted. Pending Admin Approval.',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isApproved: user.isApproved,
        approvalStatus: user.approvalStatus
      }
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
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

    if (!user.isApproved) {
      return res.status(403).json({
        message: user.approvalStatus === 'rejected' ? 'Account rejected by admin.' : 'Pending Admin Approval.'
      });
    }

    const token = createToken(user._id.toString());

    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getPendingUsers = async (req, res) => {
  try {
    let allowedRoles = [];

    if (req.user.role === 'superadmin') {
      allowedRoles = ['admin'];
    } else if (req.user.role === 'admin') {
      allowedRoles = ['tallier', 'tabulator'];
    }

    const users = await User.find({
      approvalStatus: 'pending',
      role: { $in: allowedRoles }
    })
      .select('-password')
      .sort({ createdAt: 1 });

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateApproval = async (req, res) => {
  try {
    const { decision } = req.body;

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'decision must be approve or reject.' });
    }

    const targetUser = await User.findById(req.params.id).select('-password');
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const approverRole = req.user.role;
    const canSuperadminApprove = approverRole === 'superadmin' && targetUser.role === 'admin';
    const canAdminApprove =
      approverRole === 'admin' && ['tallier', 'tabulator'].includes(targetUser.role);

    if (!canSuperadminApprove && !canAdminApprove) {
      return res.status(403).json({
        message: 'Forbidden: you can only approve allowed roles for your account type.'
      });
    }

    const isApprove = decision === 'approve';

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isApproved: isApprove,
        approvalStatus: isApprove ? 'approved' : 'rejected'
      },
      { new: true, runValidators: true }
    ).select('-password');

    await writeAudit({
      action: isApprove ? 'ADMIN_APPROVED_USER' : 'ADMIN_REJECTED_USER',
      actorId: req.user._id,
      entityType: 'user',
      entityId: user._id,
      metadata: { username: user.username, role: user.role }
    });

    return res.json(user);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const adminCreateUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ message: 'username, password, and role are required.' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    if (role === 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmin can create admin accounts.' });
    }

    if (role === 'superadmin') {
      return res.status(403).json({ message: 'Creating superadmin accounts is not allowed.' });
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
      action: 'ADMIN_CREATED_USER_BYPASS_APPROVAL',
      actorId: req.user._id,
      entityType: 'user',
      entityId: user._id,
      metadata: { username: user.username, role: user.role }
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

module.exports = {
  registerUser,
  loginUser,
  getPendingUsers,
  updateApproval,
  adminCreateUser
};
