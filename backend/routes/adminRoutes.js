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

router.get('/backup', authenticate, authorize('admin'), downloadBackup);
router.post('/log-pdf-download', authenticate, logPdfDownload);
router.get('/community-access', authenticate, authorize('admin', 'superadmin'), getCommunityAccess);
router.patch('/community-access', authenticate, authorize('admin', 'superadmin'), updateCommunityAccess);
router.patch('/community-access/events/:eventId', authenticate, authorize('admin', 'superadmin'), updateEventCommunityAccess);

module.exports = router;
