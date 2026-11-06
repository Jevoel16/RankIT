const express = require('express');
const router = express.Router();
const { start, callback, listLinks, unlink } = require('../controllers/oauthController');
const { authenticate } = require('../middleware/authMiddleware');
const { oauthLimiter } = require('../middleware/rateLimit');

router.get('/links', authenticate, listLinks);
router.get('/:provider/start', oauthLimiter, start);
router.get('/:provider/callback', oauthLimiter, callback);
router.delete('/:provider/link', authenticate, unlink);

module.exports = router;
