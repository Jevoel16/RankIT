const express = require('express');
const router = express.Router();
const { getUsers, assignRole, setStatus, resetPassword, deleteUser } = require('../controllers/userController');
const { logoutUser, getCurrentUser, loginUser } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const schemas = require('../validation/schemas');

// Accounts are created only by signing in with Google/GitHub (see /api/auth).
router.post('/login', validateBody(schemas.login), loginUser);
router.post('/logout', logoutUser);
router.get('/me', authenticate, getCurrentUser);

router.get('/', authenticate, authorize('admin'), getUsers);
router.patch('/:id/role', authenticate, authorize('admin'), validateBody(schemas.assignRole), assignRole);
router.patch('/:id/status', authenticate, authorize('admin'), validateBody(schemas.userStatus), setStatus);
router.put('/:id/password', authenticate, authorize('admin'), validateBody(schemas.resetPassword), resetPassword);
router.delete('/:id', authenticate, authorize('admin'), deleteUser);

module.exports = router;
