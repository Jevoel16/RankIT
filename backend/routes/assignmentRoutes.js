const express = require('express');
const router = express.Router();
const {
  getApprovedUsersByRole,
  assignTabulatorToEvent,
  assignTalliersToEvent,
  getTabulatorEventAssignmentSummary
} = require('../controllers/assignmentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/users', authenticate, authorize('admin', 'superadmin', 'tabulator'), getApprovedUsersByRole);
router.get('/tabulator/dashboard', authenticate, authorize('tabulator'), getTabulatorEventAssignmentSummary);
router.put('/events/:eventId/tabulator', authenticate, authorize('admin', 'superadmin'), assignTabulatorToEvent);
router.put('/events/:eventId/talliers', authenticate, authorize('tabulator'), assignTalliersToEvent);

module.exports = router;
