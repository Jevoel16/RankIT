const User = require('../models/User');
const Event = require('../models/Event');
const Contestant = require('../models/Contestant');
const ScoreSheet = require('../models/ScoreSheet');
const Audit = require('../models/Audit');

const inferCollegeLabel = (contestantName) => {
  const normalized = String(contestantName || '').trim();
  if (!normalized) {
    return 'Unspecified College';
  }

  const separatorMatch = normalized.match(/^(.*?)\s(?:-|\||:)\s/);
  if (separatorMatch && separatorMatch[1]) {
    return separatorMatch[1].trim();
  }

  return 'Unspecified College';
};

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
      talliesByEvent,
      talliesByContestant
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
      ]),
      ScoreSheet.aggregate([
        {
          $group: {
            _id: '$contestantId',
            submissions: { $sum: 1 },
            averageScore: { $avg: '$totalScore' }
          }
        },
        {
          $lookup: {
            from: 'contestants',
            localField: '_id',
            foreignField: '_id',
            as: 'contestant'
          }
        },
        {
          $project: {
            _id: 0,
            contestantId: '$_id',
            contestantName: { $ifNull: [{ $arrayElemAt: ['$contestant.name', 0] }, 'Unknown Contestant'] },
            submissions: 1,
            averageScore: { $round: ['$averageScore', 2] }
          }
        },
        { $sort: { submissions: -1, contestantName: 1 } }
      ])
    ]);

    const talliesByCollege = talliesByContestant.reduce((accumulator, row) => {
      const collegeName = inferCollegeLabel(row?.contestantName);
      const current = accumulator.get(collegeName) || {
        collegeName,
        submissions: 0,
        weightedTotal: 0
      };

      const submissions = Number(row?.submissions || 0);
      const averageScore = Number(row?.averageScore || 0);

      current.submissions += submissions;
      current.weightedTotal += averageScore * submissions;

      accumulator.set(collegeName, current);
      return accumulator;
    }, new Map());

    const normalizedCollegeRows = Array.from(talliesByCollege.values())
      .map((row) => ({
        collegeName: row.collegeName,
        submissions: row.submissions,
        averageScore:
          row.submissions > 0
            ? Number((row.weightedTotal / row.submissions).toFixed(2))
            : 0
      }))
      .sort((a, b) => {
        if (b.submissions !== a.submissions) {
          return b.submissions - a.submissions;
        }
        return a.collegeName.localeCompare(b.collegeName);
      });

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
      talliesByEvent,
      talliesByContestant,
      talliesByCollege: normalizedCollegeRows
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getOverview
};
