const express = require('express');
const router = express.Router();
const {
    submitTally,
    getEventTallies,
    getTallierEventScoreSheet,
    getMasterEventResults
} = require('../controllers/tallyController');
const { authenticate, authorize, authorizeEventAssignment } = require('../middleware/authMiddleware');

router.route('/')
    .post(authenticate, authorize('tallier'), authorizeEventAssignment({ eventIdSource: 'body' }), submitTally);

router.get('/event/:eventId', authenticate, authorize('admin', 'tabulator', 'grievancecommittee'), authorizeEventAssignment({ eventIdSource: 'params', allowAdminRoles: ['admin', 'superadmin', 'grievancecommittee'], allowedAssignedRoles: ['tabulator'] }), getEventTallies);
router.get('/mine/:eventId', authenticate, authorize('tallier'), authorizeEventAssignment({ eventIdSource: 'params', allowedAssignedRoles: ['tallier'] }), getTallierEventScoreSheet);
router.get('/master/:eventId', authenticate, authorize('admin', 'tabulator'), authorizeEventAssignment({ eventIdSource: 'params', allowedAssignedRoles: ['tabulator'] }), getMasterEventResults);

module.exports = router;
