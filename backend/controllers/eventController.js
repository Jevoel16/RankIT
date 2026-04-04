const Event = require('../models/Event');
const ScoreSheet = require('../models/ScoreSheet');
const Audit = require('../models/Audit');
const User = require('../models/User');

let attemptedLegacyCategoryIndexDrop = false;

const buildSetCriteria = ({ eventName, setCount }) => {
    const parsedSetCount = Math.max(1, Number(setCount) || 1);
    const baseWeight = Math.floor(10000 / parsedSetCount) / 100;
    const criteria = [];

    for (let index = 0; index < parsedSetCount; index += 1) {
        const isLast = index === parsedSetCount - 1;
        const weight = isLast ? Number((100 - baseWeight * (parsedSetCount - 1)).toFixed(2)) : baseWeight;

        criteria.push({
            label: `Set ${index + 1}`,
            description: `${String(eventName || 'Event').trim()} set ${index + 1}`,
            maxScore: 25,
            weight
        });
    }

    return criteria;
};

const normalizeScoringMode = (value) => (String(value || '').toLowerCase() === 'sets' ? 'sets' : 'criteria');

const writeAudit = async ({ action, actorId, eventId, entityType, entityId, metadata }) => {
    try {
        await Audit.create({ action, actorId, eventId, entityType, entityId, metadata });
    } catch (error) {
        // Logging failures should not block core endpoints.
    }
};

const normalizeObjectIdList = (items) => {
    if (!Array.isArray(items)) return [];
    return [...new Set(items.filter(Boolean).map((id) => id.toString()))];
};

const validateAssignments = async ({ tabulatorId, assignedTallierIds }) => {
    if (tabulatorId) {
        const tabulator = await User.findOne({
            _id: tabulatorId,
            role: 'tabulator',
            isApproved: true,
            approvalStatus: 'approved'
        }).select('_id');

        if (!tabulator) {
            throw new Error('Assigned tabulator must be an approved tabulator user.');
        }
    }

    if (assignedTallierIds && assignedTallierIds.length > 0) {
        const tallierCount = await User.countDocuments({
            _id: { $in: assignedTallierIds },
            role: 'tallier',
            isApproved: true,
            approvalStatus: 'approved'
        });

        if (tallierCount !== assignedTallierIds.length) {
            throw new Error('All assigned talliers must be approved tallier users.');
        }
    }
};

const computeGatekeeperState = async (eventId) => {
    const event = await Event.findById(eventId);
    if (!event) return null;

    const judgeNames = await ScoreSheet.distinct('physicalJudgeName', { eventId });
    const currentTallies = judgeNames.length;
    const unlocked = currentTallies >= event.requiredTalliers;

    event.completedTalliers = currentTallies;
    event.status = unlocked ? 'unlocked' : 'locked';
    await event.save();

    return {
        eventId: event._id,
        requiredTalliers: event.requiredTalliers,
        currentTallies,
        status: event.status,
        unlocked
    };
};

const getEvents = async (req, res) => {
    try {
        const role = req.user?.role;
        const userId = req.user?._id?.toString();
        const query = {};

        if (role === 'tabulator') {
            query.tabulatorId = userId;
        } else if (role === 'tallier') {
            query.assignedTallierIds = userId;
        }

        const events = await Event.find(query)
            .populate('tabulatorId', 'username role')
            .populate('assignedTallierIds', 'username role')
            .sort({ createdAt: -1 });
        return res.json(events);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        return res.json(event);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const createEvent = async (req, res) => {
    try {
        const normalizedTallierIds = normalizeObjectIdList(req.body.assignedTallierIds);
        const scoringMode = normalizeScoringMode(req.body.scoringMode);
        const eventName = String(req.body.name || '').trim();
        const requestedSetCount = Number(req.body.setCount || 0);

        await validateAssignments({
            tabulatorId: req.body.tabulatorId,
            assignedTallierIds: normalizedTallierIds
        });

        const generatedCriteria = scoringMode === 'sets'
            ? (req.body.criteria && Array.isArray(req.body.criteria) && req.body.criteria.length > 0)
                ? req.body.criteria.map((item) => ({
                    label: item.label || `Set ${req.body.criteria.indexOf(item) + 1}`,
                    description: item.description || `${String(eventName || 'Event').trim()} set ${req.body.criteria.indexOf(item) + 1}`,
                    maxScore: Number(item.maxScore) || 25,
                    weight: Number(item.weight) || 0
                }))
                : buildSetCriteria({
                    eventName,
                    setCount: requestedSetCount || 5
                })
            : (req.body.criteria || []).filter((item) => item && item.label && Number(item.weight) > 0);

        const payload = {
            ...req.body,
            scoringMode,
            sportName: '',
            setCount: scoringMode === 'sets' ? (requestedSetCount || generatedCriteria.length) : null,
            criteria: generatedCriteria,
            tabulatorId: req.body.tabulatorId || null,
            assignedTallierIds: normalizedTallierIds
        };

        if (!payload.name || !String(payload.name).trim()) {
            return res.status(400).json({ message: 'Event name is required.' });
        }

        if (!payload.category || !String(payload.category).trim()) {
            return res.status(400).json({ message: 'Event category is required.' });
        }

        if (scoringMode !== 'sets' && (!Array.isArray(payload.criteria) || payload.criteria.length === 0)) {
            return res.status(400).json({ message: 'At least one valid criterion is required.' });
        }

        let event;

        try {
            event = await Event.create(payload);
        } catch (error) {
            if (error && error.code === 11000 && !attemptedLegacyCategoryIndexDrop) {
                attemptedLegacyCategoryIndexDrop = true;
                try {
                    await Event.collection.dropIndex('category_1');
                    event = await Event.create(payload);
                } catch (retryError) {
                    throw retryError;
                }
            } else {
                throw error;
            }
        }

        await writeAudit({
            action: 'ADMIN_CREATED_EVENT',
            actorId: req.user._id,
            eventId: event._id,
            entityType: 'event',
            entityId: event._id,
            metadata: { name: event.name, category: event.category }
        });

        if (event.tabulatorId) {
            await writeAudit({
                action: 'EVENT_TABULATOR_ASSIGNED',
                actorId: req.user._id,
                eventId: event._id,
                entityType: 'event',
                entityId: event._id,
                metadata: { tabulatorId: event.tabulatorId }
            });
        }

        if (Array.isArray(event.assignedTallierIds) && event.assignedTallierIds.length > 0) {
            await writeAudit({
                action: 'EVENT_TALLIER_ASSIGNED',
                actorId: req.user._id,
                eventId: event._id,
                entityType: 'event',
                entityId: event._id,
                metadata: { assignedTallierIds: event.assignedTallierIds }
            });
        }

        return res.status(201).json(event);
    } catch (error) {
        if (error && error.name === 'ValidationError') {
            const details = Object.values(error.errors || {}).map((err) => err.message);
            return res.status(400).json({
                message: 'Event validation failed.',
                details
            });
        }

        if (error && error.code === 11000) {
            return res.status(409).json({ message: 'Duplicate key conflict while creating event.' });
        }

        return res.status(400).json({ message: error.message });
    }
};

const updateEvent = async (req, res) => {
    try {
        const existing = await Event.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        const nextScoringMode = normalizeScoringMode(
            Object.prototype.hasOwnProperty.call(req.body, 'scoringMode') ? req.body.scoringMode : existing.scoringMode
        );
        const nextEventName = Object.prototype.hasOwnProperty.call(req.body, 'name')
            ? String(req.body.name || '').trim()
            : String(existing.name || '').trim();
        const nextSetCount = Object.prototype.hasOwnProperty.call(req.body, 'setCount')
            ? Number(req.body.setCount || 0)
            : Number(existing.setCount || 0);
        const nextCriteria = nextScoringMode === 'sets'
            ? (Object.prototype.hasOwnProperty.call(req.body, 'criteria') && Array.isArray(req.body.criteria) && req.body.criteria.length > 0)
                ? req.body.criteria.map((item) => ({
                    label: item.label || `Set ${req.body.criteria.indexOf(item) + 1}`,
                    description: item.description || `${String(nextEventName || 'Event').trim()} set ${req.body.criteria.indexOf(item) + 1}`,
                    maxScore: Number(item.maxScore) || 25,
                    weight: Number(item.weight) || 0
                }))
                : buildSetCriteria({ eventName: nextEventName, setCount: nextSetCount || 5 })
            : (Object.prototype.hasOwnProperty.call(req.body, 'criteria')
                ? (req.body.criteria || []).filter((item) => item && item.label && Number(item.weight) > 0)
                : Array.isArray(existing.criteria) && existing.criteria.length > 0
                    ? existing.criteria
                    : []);

        const nextTabulatorId = Object.prototype.hasOwnProperty.call(req.body, 'tabulatorId')
            ? (req.body.tabulatorId || null)
            : existing.tabulatorId;
        const nextAssignedTallierIds = Object.prototype.hasOwnProperty.call(req.body, 'assignedTallierIds')
            ? normalizeObjectIdList(req.body.assignedTallierIds)
            : normalizeObjectIdList(existing.assignedTallierIds || []);

        await validateAssignments({
            tabulatorId: nextTabulatorId,
            assignedTallierIds: nextAssignedTallierIds
        });

        Object.assign(existing, req.body);
        existing.scoringMode = nextScoringMode;
        existing.sportName = '';
        existing.setCount = nextScoringMode === 'sets' ? (nextSetCount || nextCriteria.length || 5) : null;
        existing.criteria = nextCriteria;
        existing.tabulatorId = nextTabulatorId;
        existing.assignedTallierIds = nextAssignedTallierIds;
        const updated = await existing.save();

        await writeAudit({
            action: 'ADMIN_UPDATED_EVENT',
            actorId: req.user._id,
            eventId: updated._id,
            entityType: 'event',
            entityId: updated._id,
            metadata: { updates: req.body }
        });

        if (Object.prototype.hasOwnProperty.call(req.body, 'tabulatorId')) {
            await writeAudit({
                action: 'EVENT_TABULATOR_ASSIGNED',
                actorId: req.user._id,
                eventId: updated._id,
                entityType: 'event',
                entityId: updated._id,
                metadata: { tabulatorId: updated.tabulatorId }
            });
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'assignedTallierIds')) {
            await writeAudit({
                action: 'EVENT_TALLIER_ASSIGNED',
                actorId: req.user._id,
                eventId: updated._id,
                entityType: 'event',
                entityId: updated._id,
                metadata: { assignedTallierIds: updated.assignedTallierIds }
            });
        }

        return res.json(updated);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

const deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        await writeAudit({
            action: 'ADMIN_DELETED_EVENT',
            actorId: req.user._id,
            eventId: event._id,
            entityType: 'event',
            entityId: event._id,
            metadata: { name: event.name, category: event.category }
        });

        return res.json({ message: 'Event deleted successfully.' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getEventUnlockStatus = async (req, res) => {
    try {
        const state = await computeGatekeeperState(req.params.id);
        if (!state) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        return res.json(state);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const patchEventStatus = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { eventStatus } = req.body;
        const adminId = req.user?._id;

        // Validate input
        if (!['scheduled', 'live', 'finalized'].includes(eventStatus)) {
            return res.status(400).json({ message: 'Invalid event status. Must be scheduled, live, or finalized.' });
        }

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        // Additional checks for finalization
        if (eventStatus === 'finalized') {
            // Verify gatekeeper logic is satisfied (all required talliers submitted)
            const tallyCount = await ScoreSheet.distinct('physicalJudgeName', { eventId });
            if (tallyCount.length < event.requiredTalliers) {
                return res.status(400).json({ 
                    message: `Cannot finalize: Only ${tallyCount.length} of ${event.requiredTalliers} required talliers have submitted.` 
                });
            }

            // Calculate final rankings using aggregation pipeline
            const Contestant = require('../models/Contestant');
            
            const finalRankings = await Contestant.aggregate([
                {
                    $match: { eventId: event._id }
                },
                {
                    $lookup: {
                        from: 'scoresheets',
                        let: { contestantId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$contestantId', '$$contestantId'] },
                                            { $eq: ['$eventId', event._id] }
                                        ]
                                    }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    averageScore: { $avg: '$totalScore' }
                                }
                            }
                        ],
                        as: 'stats'
                    }
                },
                {
                    $unwind: {
                        path: '$stats',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $addFields: {
                        averageScore: { $ifNull: ['$stats.averageScore', 0] },
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
                },
                {
                    $addFields: {
                        finalScore: { $subtract: ['$averageScore', '$deductionPoints'] }
                    }
                },
                {
                    $sort: { finalScore: -1, averageScore: -1 }
                },
                {
                    $group: {
                        _id: null,
                        results: {
                            $push: {
                                contestantId: '$_id',
                                contestantNumber: '$contestantNumber',
                                contestantName: '$name',
                                averageScore: '$averageScore',
                                totalDeductions: '$deductionPoints',
                                finalScore: '$finalScore'
                            }
                        }
                    }
                },
                {
                    $unwind: {
                        path: '$results',
                        includeArrayIndex: 'rank'
                    }
                },
                {
                    $addFields: {
                        'results.rank': { $add: ['$rank', 1] }
                    }
                },
                {
                    $replaceRoot: { newRoot: '$results' }
                }
            ]);

            event.finalResults = finalRankings;
            event.finalizedAt = new Date();
            event.finalizedBy = adminId;
        }

        // Update event status
        event.eventStatus = eventStatus;
        await event.save();

        // Log audit trail
        await writeAudit({
            action: `EVENT_${eventStatus.toUpperCase()}`,
            actorId: adminId,
            eventId: event._id,
            entityType: 'event',
            entityId: event._id,
            metadata: {
                eventName: event.name,
                previousStatus: event.eventStatus,
                newStatus: eventStatus,
                finalResultsCount: eventStatus === 'finalized' ? event.finalResults.length : 0
            }
        });

        return res.status(200).json({
            message: `Event status updated to ${eventStatus}`,
            event: {
                _id: event._id,
                name: event.name,
                eventStatus: event.eventStatus,
                finalizedAt: event.finalizedAt,
                finalResults: event.finalResults
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    computeGatekeeperState,
    getEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventUnlockStatus,
    patchEventStatus
};
