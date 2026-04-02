const express = require('express');
const router = express.Router();
const {
    getUsers,
    createUser,
    updateUser,
    deleteUser
} = require('../controllers/userController');
const {
    registerUser,
    loginUser,
    getPendingUsers,
    updateApproval,
    adminCreateUser
} = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/pending', authenticate, authorize('admin', 'superadmin'), getPendingUsers);
router.patch('/:id/approval', authenticate, authorize('admin', 'superadmin'), updateApproval);
router.post('/admin-create', authenticate, authorize('admin', 'superadmin'), adminCreateUser);

router
    .route('/')
    .get(authenticate, authorize('superadmin'), getUsers)
    .post(authenticate, authorize('admin', 'superadmin'), createUser);

router
    .route('/:id')
    .put(authenticate, authorize('admin', 'superadmin'), updateUser)
    .delete(authenticate, authorize('admin', 'superadmin'), deleteUser);

module.exports = router;
