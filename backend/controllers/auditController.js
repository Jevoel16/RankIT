const Audit = require('../models/Audit');

const getAudits = async (req, res) => {
  const filter = {};
  if (req.query.eventId) {
    filter.eventId = req.query.eventId;
  }

  const logs = await Audit.find(filter)
    .populate('actorId', 'username role')
    .sort({ createdAt: -1 });

  return res.json(logs);
};

const getAuditById = async (req, res) => {
  const log = await Audit.findById(req.params.id).populate('actorId', 'username role');

  if (!log) {
    return res.status(404).json({ message: 'Audit log not found.' });
  }

  return res.json(log);
};

module.exports = {
  getAudits,
  getAuditById
};
