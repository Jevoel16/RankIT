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
const { validateBody } = require('../middleware/validate');
const schemas = require('../validation/schemas');

router
    .route('/')
    .get(authenticate, authorize('admin', 'tabulator', 'grievance'), getEvents)
    .post(authenticate, authorize('admin'), validateBody(schemas.createEvent), createEvent);

router
    .route('/:id')
    .get(authenticate, authorize('admin', 'tabulator', 'grievance'), authorizeEventAssignment({ eventIdSource: 'params', allowAdminRoles: ['admin', 'grievance'] }), getEvent)
    .put(authenticate, authorize('admin'), validateBody(schemas.updateEvent), updateEvent)
    .delete(authenticate, authorize('admin'), deleteEvent);

router.get('/:id/unlock-status', authenticate, authorize('admin', 'tabulator', 'grievance'), authorizeEventAssignment({ eventIdSource: 'params', allowAdminRoles: ['admin', 'grievance'] }), getEventUnlockStatus);

router.patch('/:eventId/status', authenticate, authorize('admin'), validateBody(schemas.eventStatus), patchEventStatus);

module.exports = router;
