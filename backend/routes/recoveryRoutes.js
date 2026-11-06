const express = require('express');
const router = express.Router();
const { listAccounts, promoteToAdmin, resetAdminPassword } = require('../controllers/recoveryController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const schemas = require('../validation/schemas');

router.use(authenticate, authorize('superadmin'));

router.get('/accounts', listAccounts);
router.patch('/:id/promote', promoteToAdmin);
router.put('/:id/password', validateBody(schemas.resetPassword), resetAdminPassword);

module.exports = router;
