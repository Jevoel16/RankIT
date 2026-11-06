const express = require('express');
const router = express.Router();
const { start, callback, getSetup, setupPassword, listLinks, unlink } = require('../controllers/oauthController');
const { authenticate } = require('../middleware/authMiddleware');
const { oauthLimiter, setupLimiter } = require('../middleware/rateLimit');
const { validateBody } = require('../middleware/validate');
const schemas = require('../validation/schemas');

router.get('/links', authenticate, listLinks);
router.get('/setup', getSetup);
router.post('/setup-password', setupLimiter, validateBody(schemas.setupPassword), setupPassword);
router.get('/:provider/start', oauthLimiter, start);
router.get('/:provider/callback', oauthLimiter, callback);
router.delete('/:provider/link', authenticate, unlink);

module.exports = router;
