const express = require('express');
const router = express.Router();
const {
  getAudits,
  getAuditById
} = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize('superadmin'), getAudits);

router.get('/:id', authenticate, authorize('superadmin'), getAuditById);

module.exports = router;
