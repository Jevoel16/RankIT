const express = require('express');
const router = express.Router();
const { getPublicLeaderboard } = require('../controllers/publicController');
const { getPublicOverallRankings, getPublicCategoryRankings } = require('../controllers/rankingController');

router.get('/leaderboard', getPublicLeaderboard);
router.get('/rankings/category/:categoryName', getPublicCategoryRankings);
router.get('/overall-leaderboard', getPublicOverallRankings);

module.exports = router;
