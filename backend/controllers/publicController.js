const Event = require('../models/Event');
const Contestant = require('../models/Contestant');
const Tally = require('../models/Tally');

const getPublicLeaderboard = async (req, res) => {
  try {
    const requestedCategory = String(req.query.category || '').trim().toLowerCase();
    const requestedEventId = String(req.query.eventId || '').trim();

    const eventFilter = requestedCategory ? { category: requestedCategory } : {};

    const [matchingEvents, categories] = await Promise.all([
      Event.find(eventFilter).sort({ status: 1, createdAt: -1 }),
      Event.distinct('category')
    ]);

    const selectedById = requestedEventId
      ? matchingEvents.find((item) => item._id.toString() === requestedEventId)
      : null;

    const event = selectedById || matchingEvents.find((item) => item.status === 'locked') || matchingEvents[0];

    if (!event) {
      return res.json({
        noActiveEvent: true,
        message: 'Stay tuned for the next event.',
        categories: (categories || []).filter(Boolean).sort(),
        events: [],
        selectedEventId: null,
        event: null,
        leaderboard: [],
        winners: [],
        latestUpdate: null
      });
    }

    const leaderboard = await Contestant.aggregate([
      {
        $match: {
          eventId: event._id
        }
      },
      {
        $lookup: {
          from: 'tallies',
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
          latestSubmittedAt: '$stats.latestSubmittedAt'
        }
      },
      {
        $sort: {
          averageScore: -1,
          totalScore: -1,
          contestantNumber: 1,
          name: 1
        }
      },
      {
        $setWindowFields: {
          sortBy: {
            averageScore: -1
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
          averageScore: { $round: ['$averageScore', 2] },
          totalScore: { $round: ['$totalScore', 2] },
          submissions: 1,
          latestSubmittedAt: 1
        }
      },
      {
        $sort: {
          liveRank: 1,
          totalScore: -1,
          contestantNumber: 1,
          contestantName: 1
        }
      }
    ]);

    const latestTally = await Tally.findOne({ eventId: event._id })
      .sort({ submittedAt: -1 })
      .select('contestantId submittedAt')
      .lean();

    let latestUpdate = null;

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

    const isLive = event.status === 'locked';
    const winners = isLive ? [] : leaderboard.slice(0, 3);
    const events = (matchingEvents || []).map((item) => {
      const isItemLive = item.status === 'locked';
      return {
        eventId: item._id,
        eventName: item.name,
        category: item.category,
        status: item.status,
        displayStatus: isItemLive ? 'In-Progress' : 'Completed',
        badge: isItemLive ? 'LIVE' : 'FINAL'
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
        displayStatus: isLive ? 'In-Progress' : 'Completed',
        badge: isLive ? 'LIVE' : 'FINAL'
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
