const express = require('express');
const router = express.Router();
const {
	getContestantsByEvent,
	createContestant,
	bulkCreateContestants
} = require('../controllers/contestantController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize('admin', 'tabulator', 'tallier'), getContestantsByEvent);
router.post('/', authenticate, authorize('admin'), createContestant);
router.post('/bulk', authenticate, authorize('admin'), bulkCreateContestants);

module.exports = router;
