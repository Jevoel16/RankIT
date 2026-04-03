const User = require('../models/User');
const Event = require('../models/Event');
const Contestant = require('../models/Contestant');
const ScoreSheet = require('../models/ScoreSheet');
const Audit = require('../models/Audit');

const getOverview = async (_req, res) => {
  try {
    const [
      totalUsers,
      approvedUsers,
      pendingUsers,
      rejectedUsers,
      totalEvents,
      totalContestants,
      totalTallies,
      totalAudits,
      usersByRole,
      talliesByEvent
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isApproved: true }),
      User.countDocuments({ approvalStatus: 'pending' }),
      User.countDocuments({ approvalStatus: 'rejected' }),
      Event.countDocuments(),
      Contestant.countDocuments(),
      ScoreSheet.countDocuments(),
      Audit.countDocuments(),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $project: { _id: 0, role: '$_id', count: 1 } },
        { $sort: { role: 1 } }
      ]),
      ScoreSheet.aggregate([
        {
          $group: {
            _id: '$eventId',
            submissions: { $sum: 1 },
            averageScore: { $avg: '$totalScore' }
          }
        },
        {
          $lookup: {
            from: 'events',
            localField: '_id',
            foreignField: '_id',
            as: 'event'
          }
        },
        {
          $project: {
            _id: 0,
            eventId: '$_id',
            eventName: { $ifNull: [{ $arrayElemAt: ['$event.name', 0] }, 'Unknown Event'] },
            submissions: 1,
            averageScore: { $round: ['$averageScore', 2] }
          }
        },
        { $sort: { submissions: -1 } }
      ])
    ]);

    return res.json({
      totals: {
        users: totalUsers,
        approvedUsers,
        pendingUsers,
        rejectedUsers,
        events: totalEvents,
        contestants: totalContestants,
        tallies: totalTallies,
        audits: totalAudits
      },
      usersByRole,
      talliesByEvent
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getOverview
};
