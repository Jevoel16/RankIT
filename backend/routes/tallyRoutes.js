const express = require('express');
const router = express.Router();
const {
    submitTally,
    getEventTallies
} = require('../controllers/tallyController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.route('/')
    .post(authenticate, authorize('tallier'), submitTally);

router.get('/event/:eventId', authenticate, authorize('admin', 'tabulator'), getEventTallies);

module.exports = router;
