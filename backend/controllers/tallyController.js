const Tally = require('../models/Tally');
const Event = require('../models/Event');
const Contestant = require('../models/Contestant');
const Audit = require('../models/Audit');
const { computeGatekeeperState } = require('./eventController');

const writeAudit = async ({ action, actorId, eventId, entityType, entityId, metadata }) => {
    try {
        await Audit.create({ action, actorId, eventId, entityType, entityId, metadata });
    } catch (error) {
        // Logging failures should not block core endpoints.
    }
};

const submitTally = async (req, res) => {
    try {
        const { eventId, contestantId, tallierId, scores } = req.body;

        if (!eventId || !contestantId || !Array.isArray(scores) || scores.length === 0) {
            return res.status(400).json({ message: 'eventId, contestantId, and scores are required.' });
        }

        if (tallierId && tallierId !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Talliers can only submit scores as themselves.' });
        }

        const [event, contestant] = await Promise.all([
            Event.findById(eventId),
            Contestant.findById(contestantId)
        ]);

        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        if (!contestant) {
            return res.status(404).json({ message: 'Contestant not found.' });
        }

        if (contestant.eventId.toString() !== event._id.toString()) {
            return res.status(400).json({ message: 'Contestant does not belong to the selected event.' });
        }

        const tally = await Tally.create({
            eventId,
            contestantId,
            tallierId: req.user._id,
            scores
        });

        const gatekeeper = await computeGatekeeperState(eventId);

        await writeAudit({
            action: 'TALLIER_SUBMITTED_SCORE',
            actorId: req.user._id,
            eventId,
            entityType: 'tally',
            entityId: tally._id,
            metadata: {
                contestantId,
                totalScore: tally.totalScore,
                unlockState: gatekeeper
            }
        });

        return res.status(201).json({
            tally,
            unlockState: gatekeeper
        });
    } catch (error) {
        if (error && error.code === 11000) {
            return res.status(409).json({
                message: 'Duplicate score submission: this tallier already scored this contestant for the event.'
            });
        }

        return res.status(400).json({ message: error.message });
    }
};

const getEventTallies = async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        const rankings = await Tally.aggregate([
            { $match: { eventId: event._id } },
            {
                $group: {
                    _id: '$contestantId',
                    averageScore: { $avg: '$totalScore' },
                    submissions: { $sum: 1 }
                }
            },
            { $sort: { averageScore: -1 } },
            {
                $lookup: {
                    from: 'contestants',
                    let: { contestantId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$_id', '$$contestantId'] },
                                        { $eq: ['$eventId', event._id] }
                                    ]
                                }
                            }
                        },
                        {
                            $project: {
                                name: 1
                            }
                        }
                    ],
                    as: 'contestant'
                }
            },
            { $match: { contestant: { $ne: [] } } },
            {
                $project: {
                    _id: 0,
                    contestantId: '$_id',
                    contestantName: { $ifNull: [{ $arrayElemAt: ['$contestant.name', 0] }, 'Unknown'] },
                    averageScore: { $round: ['$averageScore', 4] },
                    submissions: 1
                }
            }
        ]);

        return res.json({
            eventId,
            status: event.status,
            requiredTalliers: event.requiredTalliers,
            completedTalliers: event.completedTalliers,
            rankings
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    submitTally,
    getEventTallies
};
