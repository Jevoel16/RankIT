const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: [true, 'Action is required'],
            trim: true
        },
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Actor user ID is required']
        },
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event'
        },
        entityType: {
            type: String,
            enum: ['event', 'user', 'tally', 'contestant', 'system'],
            required: [true, 'Entity type is required']
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.model('Audit', auditSchema);
