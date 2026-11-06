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
router.post('/log-pdf-download', authenticate, validateBody(schemas.pdfDownload), logPdfDownload);
router.get('/community-access', authenticate, authorize('admin', 'superadmin'), getCommunityAccess);
router.patch('/community-access', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.communityAccess), updateCommunityAccess);
router.patch('/community-access/events/:eventId', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.eventCommunityAccess), updateEventCommunityAccess);

module.exports = router;
