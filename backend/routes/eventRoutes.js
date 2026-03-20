const express = require('express');
const router = express.Router();
const {
    getEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventUnlockStatus
} = require('../controllers/eventController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router
    .route('/')
    .get(authenticate, authorize('admin', 'tabulator', 'tallier'), getEvents)
    .post(authenticate, authorize('admin'), createEvent);

router
    .route('/:id')
    .get(authenticate, authorize('admin', 'tabulator', 'tallier'), getEvent)
    .put(authenticate, authorize('admin'), updateEvent)
    .delete(authenticate, authorize('admin'), deleteEvent);

router.get('/:id/unlock-status', authenticate, authorize('admin', 'tabulator', 'tallier'), getEventUnlockStatus);

module.exports = router;
