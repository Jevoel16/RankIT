const Contestant = require('../models/Contestant');
const Event = require('../models/Event');

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

module.exports = {
  getContestantsByEvent,
  createContestant,
  bulkCreateContestants
};
