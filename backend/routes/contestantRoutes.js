const express = require('express');
const router = express.Router();
const {
	getContestantsByEvent,
	createContestant,
	updateContestant,
	bulkCreateContestants,
	deductContestantScore
} = require('../controllers/contestantController');
const { authenticate, authorize, authorizeEventAssignment } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const schemas = require('../validation/schemas');

router.get('/', authenticate, authorize('admin', 'tabulator', 'grievance'), authorizeEventAssignment({ eventIdSource: 'query', allowAdminRoles: ['admin', 'grievance'] }), getContestantsByEvent);
router.post('/', authenticate, authorize('admin'), validateBody(schemas.createContestant), createContestant);
router.patch('/:id', authenticate, authorize('admin'), validateBody(schemas.updateContestant), updateContestant);
router.post('/bulk', authenticate, authorize('admin'), validateBody(schemas.bulkContestants), bulkCreateContestants);
router.patch('/:id/deduct', authenticate, authorize('grievance'), validateBody(schemas.deduction), deductContestantScore);

module.exports = router;
