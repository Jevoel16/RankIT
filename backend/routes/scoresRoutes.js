const express = require('express');
const router = express.Router();
const { authenticate, authorize, authorizeEventAssignment } = require('../middleware/authMiddleware');
const { recordOfflineScore, getEventScores, getMasterEventResults, generateSportsTop4Pairings } = require('../controllers/scoresController');

router.post('/record', authenticate, authorize('tabulator'), authorizeEventAssignment({ eventIdSource: 'body', allowedAssignedRoles: ['tabulator'] }), recordOfflineScore);
router.get('/event/:id', authenticate, authorize('admin', 'tabulator', 'grievance'), authorizeEventAssignment({ eventIdSource: 'params', allowAdminRoles: ['admin', 'superadmin', 'grievance'], allowedAssignedRoles: ['tabulator'] }), getEventScores);
router.get('/master/:eventId', authenticate, authorize('admin', 'tabulator'), authorizeEventAssignment({ eventIdSource: 'params', allowedAssignedRoles: ['tabulator'] }), getMasterEventResults);
router.post('/sports/:eventId/top4-pairings', authenticate, authorize('admin', 'tabulator'), authorizeEventAssignment({ eventIdSource: 'params', allowAdminRoles: ['admin', 'superadmin'], allowedAssignedRoles: ['tabulator'] }), generateSportsTop4Pairings);

module.exports = router;
