const express = require('express');
const router = express.Router();
const {
  getApprovedUsersByRole,
  assignTabulatorToEvent,
  assignTalliersToEvent,
  getTabulatorEventAssignmentSummary
} = require('../controllers/assignmentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const schemas = require('../validation/schemas');

router.get('/users', authenticate, authorize('admin', 'superadmin', 'tabulator'), getApprovedUsersByRole);
router.get('/tabulator/dashboard', authenticate, authorize('tabulator'), getTabulatorEventAssignmentSummary);
router.put('/events/:eventId/tabulator', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.assignTabulator), assignTabulatorToEvent);
router.put('/events/:eventId/talliers', authenticate, authorize('tabulator'), validateBody(schemas.assignTalliers), assignTalliersToEvent);

module.exports = router;
