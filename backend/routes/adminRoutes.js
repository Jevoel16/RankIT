const express = require('express');
const router = express.Router();
const { downloadBackup, logPdfDownload } = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/backup', authenticate, authorize('admin'), downloadBackup);
router.post('/log-pdf-download', authenticate, logPdfDownload);

module.exports = router;
