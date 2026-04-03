const express = require('express');
const router = express.Router();
const { getCategoryRankings, getOverallRankings } = require('../controllers/rankingController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get(
  '/category/:categoryName',
  authenticate,
  authorize('admin', 'superadmin', 'tabulator', 'grievance'),
  getCategoryRankings
);

router.get(
  '/overall',
  authenticate,
  authorize('admin', 'superadmin', 'tabulator', 'grievance'),
  getOverallRankings
);

module.exports = router;
