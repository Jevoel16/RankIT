const Event = require('../models/Event');
const Contestant = require('../models/Contestant');
const ScoreSheet = require('../models/ScoreSheet');
const SportsMatch = require('../models/SportsMatch');
const CommunityAccess = require('../models/CommunityAccess');
const { buildSportsStandings, buildSportsRankings } = require('../utils/sportsStandings');

const COMMUNITY_ACCESS_KEY = 'public-rankings';

const getOrCreateCommunityAccess = async () => {
  const existing = await CommunityAccess.findOne({ key: COMMUNITY_ACCESS_KEY });
  if (existing) return existing;

  return CommunityAccess.create({ key: COMMUNITY_ACCESS_KEY });
};

const isEventLiveForCommunity = (event) => {
  const eventStatus = String(event?.eventStatus || '').toLowerCase();
  const gateStatus = String(event?.status || '').toLowerCase();

  if (eventStatus === 'live') return true;
  if (eventStatus === 'finalized') return false;

  // Backward compatibility for legacy events still relying on locked/unlocked state.
  return gateStatus === 'locked';
};

const getPublicLeaderboard = async (req, res) => {
  try {
    const requestedCategory = String(req.query.category || '').trim();
    const requestedEventId = String(req.query.eventId || '').trim();

    const eventFilter = {
      communityVisible: { $ne: false },
      ...(requestedCategory ? { category: new RegExp(`^${requestedCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } : {})
    };

    const [matchingEvents, categories, communityAccess] = await Promise.all([
      Event.find(eventFilter).sort({ status: 1, createdAt: -1 }),
      Event.distinct('category', { communityVisible: { $ne: false } }),
      getOrCreateCommunityAccess()
    ]);

    const selectedById = requestedEventId
      ? matchingEvents.find((item) => item._id.toString() === requestedEventId)
      : null;

    const event = selectedById || matchingEvents.find((item) => isEventLiveForCommunity(item)) || matchingEvents[0];

    if (!event) {
      return res.json({
        noActiveEvent: true,
        message: 'Stay tuned for the next event.',
        categories: (categories || []).filter(Boolean).sort(),
        events: [],
        selectedEventId: null,
        event: null,
        rankingAccess: {
          categoryRankingsEnabled: Boolean(communityAccess.categoryRankingsEnabled),
          overallRankingsEnabled: Boolean(communityAccess.overallRankingsEnabled)
        },
        leaderboard: [],
        winners: [],
        latestUpdate: null
      });
    }

    const isSportsEvent = event.category === 'Sports Events Category';

    let leaderboard = [];
    let latestUpdate = null;

    if (isSportsEvent) {
      const sportsState = await buildSportsStandings(event._id);
      leaderboard = buildSportsRankings({ standings: sportsState.standings, matches: sportsState.matches });

      const latestMatch = await SportsMatch.findOne({ eventId: event._id, winnerContestantId: { $ne: null } })
        .sort({ playedAt: -1, updatedAt: -1 })
        .select('playedAt stage matchNumber')
        .lean();

      if (latestMatch) {
        const stageLabel = String(latestMatch.stage || 'pregame').toUpperCase();
        latestUpdate = {
          submittedAt: latestMatch.playedAt,
          message: `A ${stageLabel} match result has been recorded!`
        };
      }
    } else {
      leaderboard = await Contestant.aggregate([
        {
          $match: {
            eventId: event._id
          }
        },
        {
          $lookup: {
            from: 'scoresheets',
            let: { contestantId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$contestantId', '$$contestantId'] },
                      { $eq: ['$eventId', event._id] }
                    ]
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  totalScore: { $sum: '$totalScore' },
                  averageScore: { $avg: '$totalScore' },
                  submissions: { $sum: 1 },
                  latestSubmittedAt: { $max: '$submittedAt' }
                }
              }
            ],
            as: 'stats'
          }
        },
        {
          $unwind: {
            path: '$stats',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            totalScore: { $ifNull: ['$stats.totalScore', 0] },
            averageScore: { $ifNull: ['$stats.averageScore', 0] },
            submissions: { $ifNull: ['$stats.submissions', 0] },
            latestSubmittedAt: '$stats.latestSubmittedAt',
            deductionPoints: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$grievances', []] },
                  as: 'entry',
                  in: { $ifNull: ['$$entry.deductionPoints', 0] }
                }
              }
            }
          }
        },
        {
          $addFields: {
            adjustedAverageScore: { $subtract: ['$averageScore', '$deductionPoints'] },
            adjustedTotalScore: { $subtract: ['$totalScore', '$deductionPoints'] }
          }
        },
        {
          $sort: {
            adjustedAverageScore: -1,
            adjustedTotalScore: -1,
            contestantNumber: 1,
            name: 1
          }
        },
        {
          $setWindowFields: {
            sortBy: {
              adjustedAverageScore: -1
            },
            output: {
              liveRank: {
                $denseRank: {}
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            contestantId: '$_id',
            contestantName: '$name',
            contestantNumber: 1,
            liveRank: 1,
            averageScore: { $round: ['$adjustedAverageScore', 2] },
            totalScore: { $round: ['$adjustedTotalScore', 2] },
            deductionPoints: { $round: ['$deductionPoints', 2] },
            submissions: 1,
            latestSubmittedAt: 1
          }
        },
        {
          $sort: {
            liveRank: 1,
            averageScore: -1,
            contestantNumber: 1,
            contestantName: 1
          }
        }
      ]);

        const latestTally = await ScoreSheet.findOne({ eventId: event._id })
        .sort({ submittedAt: -1 })
        .select('contestantId submittedAt')
        .lean();

      if (latestTally) {
        const updatedContestant = await Contestant.findById(latestTally.contestantId)
          .select('name contestantNumber')
          .lean();

        const contestantLabel = updatedContestant?.contestantNumber
          ? `Contestant #${updatedContestant.contestantNumber}`
          : updatedContestant?.name || 'a contestant';

        latestUpdate = {
          submittedAt: latestTally.submittedAt,
          message: `A new score has been cast for ${contestantLabel}!`
        };
      }
    }

    // Use final results if event is finalized, otherwise use live leaderboard
    const displayLeaderboard = event.eventStatus === 'finalized' ? event.finalResults : leaderboard;
    const isLive = isEventLiveForCommunity(event);
    const winners = isLive ? [] : displayLeaderboard.slice(0, 3);
    
    const events = (matchingEvents || []).map((item) => {
      const isLiveStatus = isEventLiveForCommunity(item);
      return {
        eventId: item._id,
        eventName: item.name,
        category: item.category,
        status: item.status,
        eventStatus: item.eventStatus,
        displayStatus: isLiveStatus ? 'In-progress' : 'Ended',
        badge: isLiveStatus ? 'IN-PROGRESS' : 'ENDED'
      };
    });

    return res.json({
      noActiveEvent: false,
      categories: (categories || []).filter(Boolean).sort(),
      events,
      selectedEventId: event._id,
      event: {
        eventId: event._id,
        eventName: event.name,
        category: event.category,
        status: event.status,
        displayStatus: isLive ? 'In-progress' : 'Ended',
        badge: isLive ? 'IN-PROGRESS' : 'ENDED'
      },
      rankingAccess: {
        categoryRankingsEnabled: Boolean(communityAccess.categoryRankingsEnabled),
        overallRankingsEnabled: Boolean(communityAccess.overallRankingsEnabled)
      },
      leaderboard,
      winners,
      latestUpdate,
      lastUpdatedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPublicLeaderboard
};
