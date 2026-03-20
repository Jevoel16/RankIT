const express = require('express');
const router = express.Router();
const { getOverview } = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/overview', authenticate, authorize('superadmin'), getOverview);

module.exports = router;
