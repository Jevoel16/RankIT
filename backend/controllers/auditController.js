const Audit = require('../models/Audit');

const getAudits = async (req, res) => {
  try {
    const filter = {};
    if (req.query.eventId) {
      filter.eventId = req.query.eventId;
    }

    const logs = await Audit.find(filter)
      .populate('actorId', 'username role')
      .sort({ createdAt: -1 });

    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAuditById = async (req, res) => {
  try {
    const log = await Audit.findById(req.params.id).populate('actorId', 'username role');

    if (!log) {
      return res.status(404).json({ message: 'Audit log not found.' });
    }

    return res.json(log);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAudits,
  getAuditById
};
