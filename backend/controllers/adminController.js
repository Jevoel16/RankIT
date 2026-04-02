const Event = require('../models/Event');
const Contestant = require('../models/Contestant');
const Tally = require('../models/Tally');
const User = require('../models/User');
const Audit = require('../models/Audit');

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
      Tally.find().lean(),
      User.find().lean(),
      Audit.find().lean()
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
        audits
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

module.exports = {
  downloadBackup,
  logPdfDownload
};
