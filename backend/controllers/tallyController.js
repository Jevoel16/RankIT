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

        // Prevent score submission if event is finalized
        if (event.eventStatus === 'finalized') {
            return res.status(403).json({ message: 'Cannot submit scores: Event has been finalized.' });
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
                                name: 1,
                                deductionPoints: {
                                    $sum: {
                                        $map: {
                                            input: { $ifNull: ['$grievances', []] },
                                            as: 'entry',
                                            in: { $ifNull: ['$$entry.deductionPoints', 0] }
                                        }
                                    }
                                }
                            }
                        }
                    ],
                    as: 'contestant'
                }
            },
            { $match: { contestant: { $ne: [] } } },
            {
                $addFields: {
                    deductionPoints: { $ifNull: [{ $arrayElemAt: ['$contestant.deductionPoints', 0] }, 0] },
                    adjustedAverageScore: {
                        $subtract: ['$averageScore', { $ifNull: [{ $arrayElemAt: ['$contestant.deductionPoints', 0] }, 0] }]
                    }
                }
            },
            { $sort: { adjustedAverageScore: -1 } },
            {
                $project: {
                    _id: 0,
                    contestantId: '$_id',
                    contestantName: { $ifNull: [{ $arrayElemAt: ['$contestant.name', 0] }, 'Unknown'] },
                    averageScore: { $round: ['$adjustedAverageScore', 4] },
                    rawAverageScore: { $round: ['$averageScore', 4] },
                    deductionPoints: { $round: ['$deductionPoints', 4] },
                    submissions: 1,
                    finalScore: { $round: ['$adjustedAverageScore', 4] }
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

const getTallierEventScoreSheet = async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const event = await Event.findById(eventId).select('name criteria');
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        const [contestants, tallies] = await Promise.all([
            Contestant.find({ eventId: event._id }).sort({ contestantNumber: 1, name: 1 }).lean(),
            Tally.find({ eventId: event._id, tallierId: req.user._id }).select('contestantId scores').lean()
        ]);

        const criteriaLabels = (event.criteria || []).map((item) => item.label).filter(Boolean);

        const tallyByContestant = new Map(
            tallies.map((tally) => [
                tally.contestantId.toString(),
                Object.fromEntries((tally.scores || []).map((score) => [score.criteriaName, score.value]))
            ])
        );

        const rows = contestants.map((contestant) => {
            const key = contestant._id.toString();
            const scoreMap = tallyByContestant.get(key) || {};
            const scores = {};

            criteriaLabels.forEach((label) => {
                scores[label] = Object.prototype.hasOwnProperty.call(scoreMap, label) ? scoreMap[label] : null;
            });

            return {
                contestantId: contestant._id,
                contestantNumber: contestant.contestantNumber || null,
                contestantName: contestant.name,
                scores
            };
        });

        return res.json({
            eventId: event._id,
            eventName: event.name,
            criteria: criteriaLabels,
            rows
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getMasterEventResults = async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const event = await Event.findById(eventId).select('name criteria requiredTalliers');
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        const [contestants, tallies, gatekeeper] = await Promise.all([
            Contestant.find({ eventId: event._id }).select('name contestantNumber grievances').sort({ contestantNumber: 1, name: 1 }).lean(),
            Tally.find({ eventId: event._id }).select('contestantId scores').lean(),
            computeGatekeeperState(event._id)
        ]);

        const criteriaLabels = (event.criteria || []).map((item) => item.label).filter(Boolean);

        const scoreBuckets = new Map();

        tallies.forEach((tally) => {
            const contestantKey = tally.contestantId.toString();
            if (!scoreBuckets.has(contestantKey)) {
                scoreBuckets.set(contestantKey, {});
            }

            const contestantScores = scoreBuckets.get(contestantKey);
            (tally.scores || []).forEach((score) => {
                if (!score || !score.criteriaName) return;
                if (!contestantScores[score.criteriaName]) {
                    contestantScores[score.criteriaName] = [];
                }
                contestantScores[score.criteriaName].push(Number(score.value || 0));
            });
        });

        const rows = contestants.map((contestant) => {
            const contestantKey = contestant._id.toString();
            const perCriterion = scoreBuckets.get(contestantKey) || {};
            const criterionScores = {};
            let totalScore = 0;
            const grievanceEntries = (contestant.grievances || []).map((entry) => ({
                reason: String(entry?.reason || '').trim(),
                deductionPoints: Number(entry?.deductionPoints || 0),
                filedBy: String(entry?.filedBy || '').trim(),
                timestamp: entry?.timestamp || null
            }));
            const deductionPoints = (contestant.grievances || []).reduce(
                (sum, item) => sum + Number(item?.deductionPoints || 0),
                0
            );

            criteriaLabels.forEach((label) => {
                const values = perCriterion[label] || [];
                if (values.length === 0) {
                    criterionScores[label] = null;
                    return;
                }

                const average = values.reduce((sum, value) => sum + value, 0) / values.length;
                const roundedAverage = Number(average.toFixed(2));
                criterionScores[label] = roundedAverage;
                totalScore += roundedAverage;
            });

            return {
                contestantId: contestant._id,
                contestantNumber: contestant.contestantNumber || null,
                contestantName: contestant.name,
                criterionScores,
                deductionPoints: Number(deductionPoints.toFixed(2)),
                deductionNotes: grievanceEntries,
                totalScore: Number((totalScore - deductionPoints).toFixed(2)),
                rawTotalScore: Number(totalScore.toFixed(2))
            };
        });

        await writeAudit({
            action: 'FULL_RESULTS_PDF_GENERATED',
            actorId: req.user._id,
            eventId: event._id,
            entityType: 'event',
            entityId: event._id,
            metadata: {
                eventName: event.name,
                rowCount: rows.length,
                criteriaCount: criteriaLabels.length,
                finalized: Boolean(gatekeeper?.unlocked)
            }
        });

        return res.json({
            eventId: event._id,
            eventName: event.name,
            criteria: criteriaLabels,
            finalized: Boolean(gatekeeper?.unlocked),
            requiredTalliers: event.requiredTalliers,
            completedTalliers: Number(gatekeeper?.currentTallies || 0),
            generatedByName: req.user?.username || 'Unknown User',
            generatedByRole: req.user?.role || 'unknown',
            generatedAt: new Date().toISOString(),
            rows
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    submitTally,
    getEventTallies,
    getTallierEventScoreSheet,
    getMasterEventResults
};
