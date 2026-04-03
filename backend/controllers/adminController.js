const Event = require('../models/Event');
const Contestant = require('../models/Contestant');
const ScoreSheet = require('../models/ScoreSheet');
const User = require('../models/User');
const Audit = require('../models/Audit');
const CommunityAccess = require('../models/CommunityAccess');
const { calculateOverallRankings, calculateCategoryRankings } = require('./rankingController');

const COMMUNITY_ACCESS_KEY = 'public-rankings';

const getOrCreateCommunityAccess = async () => {
  const existing = await CommunityAccess.findOne({ key: COMMUNITY_ACCESS_KEY });
  if (existing) return existing;

  return CommunityAccess.create({ key: COMMUNITY_ACCESS_KEY });
};

const writeAudit = async ({ action, actorId, eventId, entityType, entityId, metadata }) => {
  try {
    await Audit.create({ action, actorId, eventId, entityType, entityId, metadata });
  } catch (error) {
    // Logging failures should not block core endpoints.
  }
};

const downloadBackup = async (req, res) => {
  try {
    const userId = req.user?.id;
    const [events, contestants, scores, users, audits] = await Promise.all([
      Event.find().lean(),
      Contestant.find().lean(),
      ScoreSheet.find().lean(),
      User.find().lean(),
      Audit.find().lean()
    ]);

    const categories = [...new Set((events || []).map((event) => String(event.category || '').trim()).filter(Boolean))];
    const [overallWeightedRankings, categoryRankings] = await Promise.all([
      calculateOverallRankings(),
      Promise.all(
        categories.map(async (category) => ({
          category,
          rankings: await calculateCategoryRankings(category)
        }))
      )
    ]);

    // Log the backup download action
    if (userId) {
      await writeAudit({
        action: 'BACKUP_DOWNLOADED',
        actorId: userId,
        entityType: 'system',
        entityId: 'backup',
        metadata: { timestamp: new Date().toISOString() }
      });
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      collections: {
        events,
        contestants,
        scores,
        users,
        audits,
        computedRankings: {
          weightedPointsByRank: {
            1: 10,
            2: 7,
            3: 5,
            4: 3,
            5: 2,
            6: 1,
            7: 0
          },
          overall: overallWeightedRankings,
          byCategory: categoryRankings
        }
      }
    };

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `rankit_backup_${stamp}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const logPdfDownload = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { reportType, eventId } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!reportType) {
      return res.status(400).json({ message: 'reportType is required' });
    }

    await writeAudit({
      action: `PDF_DOWNLOADED_${String(reportType).toUpperCase()}`,
      actorId: userId,
      eventId: eventId || null,
      entityType: 'pdf_report',
      entityId: reportType,
      metadata: {
        reportType,
        eventId: eventId || null,
        timestamp: new Date().toISOString()
      }
    });

    return res.status(200).json({ message: 'Download logged' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getCommunityAccess = async (_req, res) => {
  try {
    const [settings, events] = await Promise.all([
      getOrCreateCommunityAccess(),
      Event.find().select('name category eventStatus communityVisible').sort({ createdAt: -1 }).lean()
    ]);

    return res.json({
      settings: {
        categoryRankingsEnabled: Boolean(settings.categoryRankingsEnabled),
        overallRankingsEnabled: Boolean(settings.overallRankingsEnabled)
      },
      events: events.map((event) => ({
        _id: event._id,
        name: event.name,
        category: event.category,
        eventStatus: event.eventStatus,
        communityVisible: event.communityVisible !== false
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateCommunityAccess = async (req, res) => {
  try {
    const settings = await getOrCreateCommunityAccess();

    if (Object.prototype.hasOwnProperty.call(req.body, 'categoryRankingsEnabled')) {
      settings.categoryRankingsEnabled = Boolean(req.body.categoryRankingsEnabled);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'overallRankingsEnabled')) {
      settings.overallRankingsEnabled = Boolean(req.body.overallRankingsEnabled);
    }

    await settings.save();

    await writeAudit({
      action: 'COMMUNITY_RANKINGS_ACCESS_UPDATED',
      actorId: req.user?._id,
      entityType: 'system',
      entityId: null,
      metadata: {
        categoryRankingsEnabled: settings.categoryRankingsEnabled,
        overallRankingsEnabled: settings.overallRankingsEnabled
      }
    });

    return res.json({
      message: 'Community ranking access updated.',
      settings: {
        categoryRankingsEnabled: Boolean(settings.categoryRankingsEnabled),
        overallRankingsEnabled: Boolean(settings.overallRankingsEnabled)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateEventCommunityAccess = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'communityVisible')) {
      event.communityVisible = Boolean(req.body.communityVisible);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'eventStatus')) {
      const nextStatus = String(req.body.eventStatus || '').trim().toLowerCase();
      if (!['live', 'finalized', 'scheduled'].includes(nextStatus)) {
        return res.status(400).json({ message: 'eventStatus must be live, finalized, or scheduled.' });
      }
      event.eventStatus = nextStatus;
    }

    await event.save();

    await writeAudit({
      action: 'COMMUNITY_EVENT_ACCESS_UPDATED',
      actorId: req.user?._id,
      eventId: event._id,
      entityType: 'event',
      entityId: event._id,
      metadata: {
        communityVisible: event.communityVisible,
        eventStatus: event.eventStatus
      }
    });

    return res.json({
      message: 'Community event access updated.',
      event: {
        _id: event._id,
        name: event.name,
        category: event.category,
        eventStatus: event.eventStatus,
        communityVisible: Boolean(event.communityVisible)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  downloadBackup,
  logPdfDownload,
  getCommunityAccess,
  updateCommunityAccess,
  updateEventCommunityAccess
};
