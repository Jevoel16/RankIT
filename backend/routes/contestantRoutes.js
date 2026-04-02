const express = require('express');
const router = express.Router();
const {
	getContestantsByEvent,
	createContestant,
	bulkCreateContestants,
	deductContestantScore
} = require('../controllers/contestantController');
const { authenticate, authorize, authorizeEventAssignment } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize('admin', 'tabulator', 'tallier', 'grievancecommittee'), authorizeEventAssignment({ eventIdSource: 'query', allowAdminRoles: ['admin', 'superadmin', 'grievancecommittee'] }), getContestantsByEvent);
router.post('/', authenticate, authorize('admin'), createContestant);
router.post('/bulk', authenticate, authorize('admin'), bulkCreateContestants);
router.patch('/:id/deduct', authenticate, authorize('grievancecommittee'), deductContestantScore);

module.exports = router;
