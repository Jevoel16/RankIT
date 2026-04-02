const express = require('express');
const router = express.Router();
const {
    getEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventUnlockStatus,
    patchEventStatus
} = require('../controllers/eventController');
const { authenticate, authorize, authorizeEventAssignment } = require('../middleware/authMiddleware');

router
    .route('/')
    .get(authenticate, authorize('admin', 'tabulator', 'tallier', 'grievancecommittee'), getEvents)
    .post(authenticate, authorize('admin'), createEvent);

router
    .route('/:id')
    .get(authenticate, authorize('admin', 'tabulator', 'tallier', 'grievancecommittee'), authorizeEventAssignment({ eventIdSource: 'params', allowAdminRoles: ['admin', 'superadmin', 'grievancecommittee'] }), getEvent)
    .put(authenticate, authorize('admin'), updateEvent)
    .delete(authenticate, authorize('admin'), deleteEvent);

router.get('/:id/unlock-status', authenticate, authorize('admin', 'tabulator', 'tallier', 'grievancecommittee'), authorizeEventAssignment({ eventIdSource: 'params', allowAdminRoles: ['admin', 'superadmin', 'grievancecommittee'] }), getEventUnlockStatus);

router.patch('/:eventId/status', authenticate, authorize('admin'), patchEventStatus);

module.exports = router;
