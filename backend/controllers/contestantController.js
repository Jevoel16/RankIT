const Contestant = require('../models/Contestant');
const Event = require('../models/Event');
const Audit = require('../models/Audit');

const writeAudit = async ({ action, actorId, eventId, entityType, entityId, metadata }) => {
  try {
    await Audit.create({ action, actorId, eventId, entityType, entityId, metadata });
  } catch (_error) {
    // Logging failures should not block core endpoints.
  }
};

const getContestantsByEvent = async (req, res) => {
  try {
    const { eventId } = req.query;

    if (!eventId) {
      return res.status(400).json({ message: 'eventId query parameter is required.' });
    }

    const contestants = await Contestant.find({ eventId }).sort({ contestantNumber: 1, name: 1 });
    return res.json(contestants);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createContestant = async (req, res) => {
  try {
    const { name, eventId, contestantNumber } = req.body;

    if (!name || !eventId) {
      return res.status(400).json({ message: 'name and eventId are required.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const contestant = await Contestant.create({
      name: String(name).trim(),
      eventId,
      contestantNumber
    });

    return res.status(201).json(contestant);
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: 'Contestant number already exists for this event.' });
    }
    return res.status(400).json({ message: error.message });
  }
};

const updateContestant = async (req, res) => {
  try {
    const contestant = await Contestant.findById(req.params.id);
    if (!contestant) {
      return res.status(404).json({ message: 'Contestant not found.' });
    }

    const hasName = Object.prototype.hasOwnProperty.call(req.body, 'name');
    const hasContestantNumber = Object.prototype.hasOwnProperty.call(req.body, 'contestantNumber');

    if (!hasName && !hasContestantNumber) {
      return res.status(400).json({ message: 'Provide name or contestantNumber to update.' });
    }

    if (hasName) {
      const trimmedName = String(req.body.name || '').trim();
      if (!trimmedName) {
        return res.status(400).json({ message: 'name cannot be empty.' });
      }
      contestant.name = trimmedName;
    }

    if (hasContestantNumber) {
      const rawNumber = req.body.contestantNumber;

      if (rawNumber === null || rawNumber === '' || typeof rawNumber === 'undefined') {
        contestant.contestantNumber = undefined;
      } else {
        const parsedNumber = Number(rawNumber);
        if (!Number.isInteger(parsedNumber) || parsedNumber < 1) {
          return res.status(400).json({ message: 'contestantNumber must be an integer of at least 1.' });
        }
        contestant.contestantNumber = parsedNumber;
      }
    }

    await contestant.save();
    return res.json(contestant);
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: 'Contestant number already exists for this event.' });
    }
    return res.status(400).json({ message: error.message });
  }
};

const bulkCreateContestants = async (req, res) => {
  try {
    const { eventId, contestants } = req.body;

    if (!eventId || !Array.isArray(contestants) || contestants.length === 0) {
      return res.status(400).json({ message: 'eventId and contestants array are required.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const sanitized = contestants
      .map((item) => ({
        name: String(item.name || '').trim(),
        contestantNumber: item.contestantNumber
      }))
      .filter((item) => item.name)
      .map((item) => ({ ...item, eventId }));

    if (sanitized.length === 0) {
      return res.status(400).json({ message: 'No valid contestant names provided.' });
    }

    const created = await Contestant.insertMany(sanitized, { ordered: false });
    return res.status(201).json({ createdCount: created.length, contestants: created });
  } catch (error) {
    if (error && error.writeErrors) {
      const created = error.result?.result?.nInserted || 0;
      return res.status(207).json({
        message: 'Bulk insert completed with some conflicts.',
        createdCount: created
      });
    }
    return res.status(400).json({ message: error.message });
  }
};

const deductContestantScore = async (req, res) => {
  try {
    const contestant = await Contestant.findById(req.params.id);
    if (!contestant) {
      return res.status(404).json({ message: 'Contestant not found.' });
    }

    const event = await Event.findById(contestant.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Prevent grievance filing if event is finalized
    if (event.eventStatus === 'finalized') {
      return res.status(403).json({ message: 'Cannot file grievances: Event has been finalized.' });
    }

    const reason = String(req.body.reason || '').trim();
    const deductionPoints = Number(req.body.deductionPoints);

    if (!reason) {
      return res.status(400).json({ message: 'reason is required.' });
    }

    if (!Number.isFinite(deductionPoints) || deductionPoints <= 0) {
      return res.status(400).json({ message: 'deductionPoints must be a positive number.' });
    }

    const grievanceEntry = {
      reason,
      deductionPoints,
      filedBy: req.user?.username || 'unknown',
      timestamp: new Date()
    };

    contestant.grievances = Array.isArray(contestant.grievances) ? contestant.grievances : [];
    contestant.grievances.push(grievanceEntry);
    await contestant.save();

    await writeAudit({
      action: 'SCORE_ALTERED_BY_GRIEVANCE',
      actorId: req.user._id,
      eventId: contestant.eventId,
      entityType: 'contestant',
      entityId: contestant._id,
      metadata: {
        reason,
        deductionPoints,
        filedBy: grievanceEntry.filedBy
      }
    });

    return res.json(contestant);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getContestantsByEvent,
  createContestant,
  updateContestant,
  bulkCreateContestants,
  deductContestantScore
};
