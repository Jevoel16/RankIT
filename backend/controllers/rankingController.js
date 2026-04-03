const mongoose = require('mongoose');
const Contestant = require('../models/Contestant');
const Event = require('../models/Event');
const Audit = require('../models/Audit');
const CommunityAccess = require('../models/CommunityAccess');
const { buildSportsStandings, buildSportsRankings } = require('../utils/sportsStandings');

const COMMUNITY_ACCESS_KEY = 'public-rankings';

const getOrCreateCommunityAccess = async () => {
  const existing = await CommunityAccess.findOne({ key: COMMUNITY_ACCESS_KEY });
  if (existing) return existing;

  return CommunityAccess.create({ key: COMMUNITY_ACCESS_KEY });
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const WEIGHTED_POINTS_BY_RANK = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
  5: 2,
  6: 1,
  7: 0
};

const weightedPointsFromRank = (rank) => WEIGHTED_POINTS_BY_RANK[Number(rank) || 0] || 0;

const writeAudit = async ({ action, actorId, eventId, entityType, entityId, metadata }) => {
  try {
    await Audit.create({ action, actorId, eventId, entityType, entityId, metadata });
  } catch (_error) {
    // Logging failures should not block core endpoints.
  }
};

const denseRankRows = (rows, scoreKey, tieBreakerKey) => {
  let currentRank = 0;
  let previousScore = null;

  return rows.map((row, index) => {
    const score = Number(row[scoreKey] || 0);
    if (previousScore === null || score !== previousScore) {
      currentRank = index + 1;
      previousScore = score;
    }

    return {
      ...row,
      rank: currentRank,
      ...(tieBreakerKey ? { [tieBreakerKey]: row[tieBreakerKey] } : {})
    };
  });
};

const toWeightExpression = {
  $switch: {
    branches: [
      { case: { $eq: ['$eventRank', 1] }, then: WEIGHTED_POINTS_BY_RANK[1] },
      { case: { $eq: ['$eventRank', 2] }, then: WEIGHTED_POINTS_BY_RANK[2] },
      { case: { $eq: ['$eventRank', 3] }, then: WEIGHTED_POINTS_BY_RANK[3] },
      { case: { $eq: ['$eventRank', 4] }, then: WEIGHTED_POINTS_BY_RANK[4] },
      { case: { $eq: ['$eventRank', 5] }, then: WEIGHTED_POINTS_BY_RANK[5] },
      { case: { $eq: ['$eventRank', 6] }, then: WEIGHTED_POINTS_BY_RANK[6] },
      { case: { $eq: ['$eventRank', 7] }, then: WEIGHTED_POINTS_BY_RANK[7] }
    ],
    default: 0
  }
};

const rankRowsByEvent = (rows) => {
  const groupedByEvent = new Map();

  rows.forEach((row) => {
    const eventKey = String(row.eventId);
    if (!groupedByEvent.has(eventKey)) {
      groupedByEvent.set(eventKey, []);
    }

    groupedByEvent.get(eventKey).push(row);
  });

  const rankedRows = [];

  groupedByEvent.forEach((eventRows) => {
    const hasPrecomputedRanks = eventRows.every((row) => Number.isFinite(Number(row.eventRank)) && Number(row.eventRank) > 0);

    if (hasPrecomputedRanks) {
      const sortedByRank = [...eventRows].sort((a, b) => {
        if (Number(a.eventRank) !== Number(b.eventRank)) return Number(a.eventRank) - Number(b.eventRank);
        return String(a.contestantName || '').localeCompare(String(b.contestantName || ''));
      });

      sortedByRank.forEach((row) => {
        const eventRank = Number(row.eventRank);
        rankedRows.push({
          ...row,
          eventRank,
          weightedPoints: Number(row.weightedPoints || weightedPointsFromRank(eventRank))
        });
      });

      return;
    }

    const sortedRows = [...eventRows].sort((a, b) => {
      if (b.finalEventScore !== a.finalEventScore) return b.finalEventScore - a.finalEventScore;
      return String(a.contestantName).localeCompare(String(b.contestantName));
    });

    let previousScore = null;
    let currentRank = 0;

    sortedRows.forEach((row, index) => {
      const score = Number(row.finalEventScore || 0);
      if (previousScore === null || score !== previousScore) {
        currentRank = index + 1;
        previousScore = score;
      }

      rankedRows.push({
        ...row,
        eventRank: currentRank,
        weightedPoints: weightedPointsFromRank(currentRank)
      });
    });
  });

  return rankedRows;
};

const buildBaseContestantScoringPipeline = ({ categoryName } = {}) => {
  const normalizedCategory = String(categoryName || '').trim().toLowerCase();
  const categoryTargetsSports = normalizedCategory === 'sports events category';
  const categoryFilter = categoryName
    ? (categoryTargetsSports
      ? { 'event.category': '__none__' }
      : { 'event.category': { $regex: `^${escapeRegex(String(categoryName).trim())}$`, $options: 'i' } })
    : { 'event.category': { $ne: 'Sports Events Category' } };

  const pipeline = [
    {
      $lookup: {
        from: 'events',
        localField: 'eventId',
        foreignField: '_id',
        as: 'event'
      }
    },
    { $unwind: '$event' },
    {
      $match: {
        ...categoryFilter
      }
    },
    {
      $lookup: {
        from: 'tallies',
        let: { contestantId: '$_id', eventId: '$eventId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$contestantId', '$$contestantId'] },
                  { $eq: ['$eventId', '$$eventId'] }
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              averageScore: { $avg: '$totalScore' },
              submissions: { $sum: 1 }
            }
          }
        ],
        as: 'scoreStats'
      }
    },
    {
      $unwind: {
        path: '$scoreStats',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $addFields: {
        deductionPoints: {
          $sum: {
            $map: {
              input: { $ifNull: ['$grievances', []] },
              as: 'entry',
              in: {
                $convert: {
                  input: '$$entry.deductionPoints',
                  to: 'double',
                  onError: 0,
                  onNull: 0
                }
              }
            }
          }
        },
        averageScore: { $ifNull: ['$scoreStats.averageScore', 0] },
        submissions: { $ifNull: ['$scoreStats.submissions', 0] }
      }
    },
    {
      $addFields: {
        finalEventScore: { $subtract: ['$averageScore', '$deductionPoints'] }
      }
    },
    {
      $project: {
        _id: 0,
        eventId: '$event._id',
        eventName: '$event.name',
        category: '$event.category',
        contenderKey: { $toUpper: '$name' },
        contestantName: '$name',
        contestantNumber: '$contestantNumber',
        averageScore: { $round: ['$averageScore', 4] },
        deductionPoints: { $round: ['$deductionPoints', 4] },
        finalEventScore: { $round: ['$finalEventScore', 4] },
        submissions: 1
      }
    }
  ];

  return pipeline;
};

const buildSportsPerEventRows = async ({ categoryName } = {}) => {
  const shouldIncludeSports = categoryName
    ? /^sports events category$/i.test(String(categoryName).trim())
    : true;

  if (!shouldIncludeSports) {
    return [];
  }

  const sportsEvents = await Event.find({ category: 'Sports Events Category' })
    .select('_id name category')
    .lean();

  const rows = [];

  for (const event of sportsEvents) {
    const sportsState = await buildSportsStandings(event._id);
    const rankings = buildSportsRankings({ standings: sportsState.standings, matches: sportsState.matches });

    rankings.forEach((row) => {
      const eventRank = Number(row.liveRank || 0);
      rows.push({
        eventId: event._id,
        eventName: event.name,
        category: event.category,
        contenderKey: String(row.contestantName || '').toUpperCase(),
        contestantName: row.contestantName,
        contestantNumber: row.contestantNumber || null,
        averageScore: Number(row.averageScore || 0),
        deductionPoints: 0,
        finalEventScore: Number(row.averageScore || 0),
        submissions: Number(row.submissions || 0),
        eventRank,
        weightedPoints: weightedPointsFromRank(eventRank)
      });
    });
  }

  return rows;
};

const calculateCategoryRankings = async (categoryName) => {
  const [nonSportsRows, sportsRows] = await Promise.all([
    Contestant.aggregate([
      ...buildBaseContestantScoringPipeline({ categoryName })
    ]),
    buildSportsPerEventRows({ categoryName })
  ]);

  const perEventRows = [...(nonSportsRows || []), ...(sportsRows || [])];

  const rankedEventRows = rankRowsByEvent(perEventRows);
  const totals = new Map();

  rankedEventRows.forEach((row) => {
    const contenderKey = row.contenderKey;

    if (!totals.has(contenderKey)) {
      totals.set(contenderKey, {
        contestantName: row.contestantName,
        categoryName: row.category,
        categoryTotalPoints: 0,
        eventsPlayed: 0,
        eventBreakdown: []
      });
    }

    const current = totals.get(contenderKey);
    const weightedPoints = Number(row.weightedPoints || 0);

    current.categoryTotalPoints += weightedPoints;
    current.eventsPlayed += 1;
    current.eventBreakdown.push({
      eventId: row.eventId,
      eventName: row.eventName,
      eventRank: row.eventRank,
      weightedPoints,
      averageScore: Number(row.averageScore || 0),
      deductionPoints: Number(row.deductionPoints || 0),
      finalEventScore: Number(row.finalEventScore || 0),
      submissions: Number(row.submissions || 0)
    });
  });

  const rows = [...totals.values()]
    .map((item) => ({
      ...item,
      categoryTotalPoints: Number(
        (
          item.eventsPlayed > 0
            ? Number(item.categoryTotalPoints || 0) / Number(item.eventsPlayed || 1)
            : 0
        ).toFixed(4)
      ),
      eventBreakdown: item.eventBreakdown.sort((a, b) => a.eventName.localeCompare(b.eventName))
    }))
    .sort((a, b) => {
      if (b.categoryTotalPoints !== a.categoryTotalPoints) return b.categoryTotalPoints - a.categoryTotalPoints;
      return a.contestantName.localeCompare(b.contestantName);
    });

  return denseRankRows(rows, 'categoryTotalPoints').map((row) => ({
    ...row,
    rank: row.rank
  }));
};

const calculateOverallRankings = async () => {
  const [nonSportsRows, sportsRows] = await Promise.all([
    Contestant.aggregate([
      ...buildBaseContestantScoringPipeline(),
      {
        $project: {
          _id: 0,
          contenderKey: 1,
          contestantName: 1,
          category: 1,
          eventId: 1,
          eventName: 1,
          eventRank: 1,
          weightedPoints: 1,
          finalEventScore: 1,
          averageScore: 1,
          deductionPoints: 1,
          submissions: 1
        }
      }
    ]),
    buildSportsPerEventRows()
  ]);

  const perEventRows = [...(nonSportsRows || []), ...(sportsRows || [])];

  const rankedEventRows = rankRowsByEvent(perEventRows);

  const totals = new Map();

  rankedEventRows.forEach((row) => {
    const contenderKey = row.contenderKey;
    if (!totals.has(contenderKey)) {
      totals.set(contenderKey, {
        contestantName: row.contestantName,
        weightedTotal: 0,
        categoryTotals: {},
        eventBreakdown: []
      });
    }

    const current = totals.get(contenderKey);
    const weightedPoints = Number(row.weightedPoints || 0);

    current.weightedTotal += weightedPoints;
    current.categoryTotals[row.category] = Number((current.categoryTotals[row.category] || 0) + weightedPoints);
    current.eventBreakdown.push({
      category: row.category,
      eventId: row.eventId,
      eventName: row.eventName,
      eventRank: row.eventRank,
      weightedPoints,
      finalEventScore: Number(row.finalEventScore || 0),
      averageScore: Number(row.averageScore || 0),
      deductionPoints: Number(row.deductionPoints || 0),
      submissions: Number(row.submissions || 0)
    });
  });

  const rankings = [...totals.values()]
    .map((item) => ({
      ...item,
      weightedTotal: Number(
        (
          Object.keys(item.categoryTotals).length > 0
            ? Object.values(item.categoryTotals).reduce((sum, value) => sum + Number(value || 0), 0) / Object.keys(item.categoryTotals).length
            : 0
        ).toFixed(4)
      ),
      eventBreakdown: item.eventBreakdown.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.eventName.localeCompare(b.eventName);
      })
    }))
    .sort((a, b) => {
      if (b.weightedTotal !== a.weightedTotal) return b.weightedTotal - a.weightedTotal;
      return a.contestantName.localeCompare(b.contestantName);
    })
    .map((item, index) => ({
      rank: index + 1,
      ...item
    }));

  return rankings;
};

const getCategoryRankings = async (req, res) => {
  try {
    const categoryName = String(req.params.categoryName || '').trim();

    if (!categoryName) {
      return res.status(400).json({ message: 'categoryName is required.' });
    }

    const rankings = await calculateCategoryRankings(categoryName);

    return res.json({
      category: rankings[0]?.categoryName || categoryName,
      count: rankings.length,
      rankings,
      calculatedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getOverallRankings = async (req, res) => {
  try {
    const rankings = await calculateOverallRankings();

    await writeAudit({
      action: 'OVERALL_RANKINGS_CALCULATED',
      actorId: req.user?._id,
      entityType: 'system',
      entityId: new mongoose.Types.ObjectId(),
      metadata: {
        contenderCount: rankings.length,
        calculatedAt: new Date().toISOString(),
        weightedPointsByRank: WEIGHTED_POINTS_BY_RANK
      }
    });

    return res.json({
      count: rankings.length,
      weightedPointsByRank: WEIGHTED_POINTS_BY_RANK,
      rankings,
      calculatedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getPublicOverallRankings = async (_req, res) => {
  try {
    const access = await getOrCreateCommunityAccess();
    if (!access.overallRankingsEnabled) {
      return res.status(403).json({ message: 'Overall rankings are currently hidden from the community.' });
    }

    const rankings = await calculateOverallRankings();

    return res.json({
      count: rankings.length,
      weightedPointsByRank: WEIGHTED_POINTS_BY_RANK,
      rankings,
      calculatedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getPublicCategoryRankings = async (req, res) => {
  try {
    const access = await getOrCreateCommunityAccess();
    if (!access.categoryRankingsEnabled) {
      return res.status(403).json({ message: 'Category rankings are currently hidden from the community.' });
    }

    const categoryName = String(req.params.categoryName || '').trim();

    if (!categoryName) {
      return res.status(400).json({ message: 'categoryName is required.' });
    }

    const rankings = await calculateCategoryRankings(categoryName);

    return res.json({
      category: rankings[0]?.categoryName || categoryName,
      count: rankings.length,
      rankings,
      calculatedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  WEIGHTED_POINTS_BY_RANK,
  calculateCategoryRankings,
  calculateOverallRankings,
  getCategoryRankings,
  getOverallRankings,
  getPublicOverallRankings,
  getPublicCategoryRankings
};