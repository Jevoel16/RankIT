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
const { validateBody } = require('../middleware/validate');
const schemas = require('../validation/schemas');

router.post('/register', validateBody(schemas.register), registerUser);
router.post('/login', validateBody(schemas.login), loginUser);
router.get('/pending', authenticate, authorize('admin', 'superadmin'), getPendingUsers);
router.patch('/:id/approval', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.approval), updateApproval);
router.post('/admin-create', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.adminCreateUser), adminCreateUser);

router
    .route('/')
    .get(authenticate, authorize('superadmin'), getUsers)
    .post(authenticate, authorize('admin', 'superadmin'), validateBody(schemas.createUser), createUser);

router
    .route('/:id')
    .put(authenticate, authorize('admin', 'superadmin'), validateBody(schemas.updateUser), updateUser)
    .delete(authenticate, authorize('admin', 'superadmin'), deleteUser);

module.exports = router;
