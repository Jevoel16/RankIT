const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const Audit = require('../models/Audit');

const writeAudit = async ({ action, actorId, eventId, entityType, entityId, metadata }) => {
  try {
    await Audit.create({ action, actorId, eventId, entityType, entityId, metadata });
  } catch (_error) {
    // Logging failures should not block core endpoints.
  }
};

const toUniqueIds = (items) => {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.filter(Boolean).map((id) => id.toString()))];
};

const getApprovedUsersByRole = async (req, res) => {
  try {
    const role = String(req.query.role || '').trim();
    if (!['tabulator', 'tallier'].includes(role)) {
      return res.status(400).json({ message: 'role query must be tabulator or tallier.' });
    }

    const users = await User.find({
      role,
      isApproved: true,
      approvalStatus: 'approved'
    })
      .select('_id username role')
      .sort({ username: 1 });

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const assignTabulatorToEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { tabulatorId } = req.body;

    if (!tabulatorId) {
      return res.status(400).json({ message: 'tabulatorId is required.' });
    }

    const [event, tabulator] = await Promise.all([
      Event.findById(eventId),
      User.findOne({ _id: tabulatorId, role: 'tabulator', isApproved: true, approvalStatus: 'approved' })
    ]);

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (!tabulator) {
      return res.status(404).json({ message: 'Approved tabulator not found.' });
    }

    event.tabulatorId = tabulator._id;
    await event.save();

    await writeAudit({
      action: 'EVENT_TABULATOR_ASSIGNED',
      actorId: req.user._id,
      eventId: event._id,
      entityType: 'event',
      entityId: event._id,
      metadata: {
        eventName: event.name,
        tabulatorId: tabulator._id,
        tabulatorUsername: tabulator.username
      }
    });

    return res.json(event);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const assignTalliersToEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const tallierIds = toUniqueIds(req.body.assignedTallierIds);

    if (!Array.isArray(req.body.assignedTallierIds)) {
      return res.status(400).json({ message: 'assignedTallierIds array is required.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (!event.tabulatorId || event.tabulatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden: you are not assigned as this event tabulator.' });
    }

    if (tallierIds.length > 0) {
      const validTallierCount = await User.countDocuments({
        _id: { $in: tallierIds },
        role: 'tallier',
        isApproved: true,
        approvalStatus: 'approved'
      });

      if (validTallierCount !== tallierIds.length) {
        return res.status(400).json({ message: 'All assigned IDs must be approved tallier users.' });
      }
    }

    event.assignedTallierIds = tallierIds;
    await event.save();

    await writeAudit({
      action: 'EVENT_TALLIER_ASSIGNED',
      actorId: req.user._id,
      eventId: event._id,
      entityType: 'event',
      entityId: event._id,
      metadata: {
        eventName: event.name,
        assignedTallierIds: tallierIds
      }
    });

    const populated = await Event.findById(event._id)
      .populate('tabulatorId', 'username role')
      .populate('assignedTallierIds', 'username role');

    return res.json(populated);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const getTabulatorEventAssignmentSummary = async (req, res) => {
  try {
    const tabulatorId = req.user._id;

    const pipeline = [
      {
        $match: {
          tabulatorId: new mongoose.Types.ObjectId(tabulatorId)
        }
      },
      {
        $lookup: {
          from: 'scoresheets',
          let: { eventId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$eventId', '$$eventId'] } } },
            { $group: { _id: '$tallierId' } }
          ],
          as: 'activeTallierDocs'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          category: 1,
          createdAt: 1,
          assignedTallierIds: 1,
          totalAssignedTalliers: { $size: { $ifNull: ['$assignedTallierIds', []] } },
          activeTallierIds: '$activeTallierDocs._id'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          category: 1,
          createdAt: 1,
          totalAssignedTalliers: 1,
          activeTalliers: {
            $size: {
              $setIntersection: [{ $ifNull: ['$assignedTallierIds', []] }, { $ifNull: ['$activeTallierIds', []] }]
            }
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ];

    const summary = await Event.aggregate(pipeline);

    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getApprovedUsersByRole,
  assignTabulatorToEvent,
  assignTalliersToEvent,
  getTabulatorEventAssignmentSummary
};
