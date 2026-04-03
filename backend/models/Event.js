const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Event Name is required'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Event Category is required'],
        trim: true,
        enum: ['Special Events Category', 'Literary Events Category', 'Sports Events Category']
    },
    scoringMode: {
        type: String,
        enum: ['criteria', 'sets'],
        default: 'criteria'
    },
    setCount: {
        type: Number,
        min: [1, 'Set count must be at least 1'],
        default: null
    },
    criteria: [{
        label: {
        type: String,
        required: [true, 'Label name is required'],
        trim: true
        },
        description: {
        type: String,
        trim: true
        },
        maxScore: {
        type: Number,
        min: [1, 'Maximum Score must be at least 1'],
        default: 10
        },
        weight: {
        type: Number,
        required: [true, 'Weight is required'],
        min: [0, 'Weight must be at least 0%'],
        max: [100, 'Weight cannot exceed 100%']
        }
    }],
    requiredTalliers: {
        type: Number,
        default: 1,
        min: [1, 'requiredTalliers must be at least 1']
    },
    completedTalliers: {
        type: Number,
        default: 0,
        min: [0, 'completedTalliers cannot be negative']
    },
    status: {
        type: String,
        enum: ['locked', 'unlocked'],
        default: 'locked'
    },
    eventStatus: {
        type: String,
        enum: ['scheduled', 'live', 'finalized'],
        default: 'scheduled'
    },
    communityVisible: {
        type: Boolean,
        default: true
    },
    finalizedAt: {
        type: Date,
        default: null
    },
    finalizedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    finalResults: [{
        contestantId: mongoose.Schema.Types.ObjectId,
        contestantNumber: Number,
        contestantName: String,
        rank: Number,
        averageScore: Number,
        totalDeductions: Number,
        finalScore: Number
    }],
    tabulatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assignedTallierIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

eventSchema.pre('validate', function(next) {
    const totalWeight = (this.criteria || []).reduce((sum, item) => sum + Number(item.weight || 0), 0);
    const scoringMode = this.scoringMode || 'criteria';

    if (scoringMode === 'sets') {
        if (!Number.isFinite(Number(this.setCount)) || Number(this.setCount) < 1) {
            this.invalidate('setCount', 'Set count is required for set-based events.');
        }
    }

    if (Math.abs(totalWeight - 100) > 0.0001) {
        this.invalidate('criteria', 'Total criteria weight must equal 100%.');
    }

    if (typeof next === 'function') {
        next();
    }
});

module.exports = mongoose.model('Event', eventSchema);
