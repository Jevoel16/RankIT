const Event = require('../models/Event');
const Tally = require('../models/Tally');
const Audit = require('../models/Audit');

let attemptedLegacyCategoryIndexDrop = false;

const writeAudit = async ({ action, actorId, eventId, entityType, entityId, metadata }) => {
    try {
        await Audit.create({ action, actorId, eventId, entityType, entityId, metadata });
    } catch (error) {
        // Logging failures should not block core endpoints.
    }
};

const computeGatekeeperState = async (eventId) => {
    const event = await Event.findById(eventId);
    if (!event) return null;

    const tallierIds = await Tally.distinct('tallierId', { eventId });
    const currentTallies = tallierIds.length;
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
        const events = await Event.find().sort({ createdAt: -1 });
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
        const payload = {
            ...req.body,
            criteria: (req.body.criteria || []).filter((item) => item && item.label && Number(item.weight) > 0)
        };

        if (!payload.name || !String(payload.name).trim()) {
            return res.status(400).json({ message: 'Event name is required.' });
        }

        if (!payload.category || !String(payload.category).trim()) {
            return res.status(400).json({ message: 'Event category is required.' });
        }

        if (!Array.isArray(payload.criteria) || payload.criteria.length === 0) {
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

        Object.assign(existing, req.body);
        const updated = await existing.save();

        await writeAudit({
            action: 'ADMIN_UPDATED_EVENT',
            actorId: req.user._id,
            eventId: updated._id,
            entityType: 'event',
            entityId: updated._id,
            metadata: { updates: req.body }
        });

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

module.exports = {
    computeGatekeeperState,
    getEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventUnlockStatus
};
