const express = require('express');
const router = express.Router();
const {
	downloadBackup,
	logPdfDownload,
	getCommunityAccess,
	updateCommunityAccess,
	updateEventCommunityAccess
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const schemas = require('../validation/schemas');

router.get('/backup', authenticate, authorize('admin'), downloadBackup);
router.post('/log-pdf-download', authenticate, authorize('admin', 'tabulator', 'grievance'), validateBody(schemas.pdfDownload), logPdfDownload);
router.get('/community-access', authenticate, authorize('admin'), getCommunityAccess);
router.patch('/community-access', authenticate, authorize('admin'), validateBody(schemas.communityAccess), updateCommunityAccess);
router.patch('/community-access/events/:eventId', authenticate, authorize('admin'), validateBody(schemas.eventCommunityAccess), updateEventCommunityAccess);

module.exports = router;
