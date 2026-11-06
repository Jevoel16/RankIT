const express = require('express');
const router = express.Router();
const {
  getAudits,
  getAuditById
} = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize('admin'), getAudits);

router.get('/:id', authenticate, authorize('admin'), getAuditById);

module.exports = router;
