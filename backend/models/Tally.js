const mongoose = require('mongoose');

const tallySchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event ID is required']
  },
  contestantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contestant',
    required: [true, 'Contestant ID is required']
  },
  tallierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tallier (Judge) ID is required']
  },
  // This allows the Admin to define any number of criteria
  scores: [
    {
      criteriaName: { type: String, required: true },
      value: { type: Number, required: true}
    }
  ],
  totalScore: {
    type: Number,
    default: 0
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

// --- MIDDLEWARE FOR TOTAL SCORE ---
// This runs automatically before every .save() call
tallySchema.pre('save', function(next) {
  if (this.scores && this.scores.length > 0) {
    this.totalScore = this.scores.reduce((acc, curr) => acc + curr.value, 0);
  }

  if (typeof next === 'function') {
    next();
  }
});

// --- INDEXING FOR SPEED ---
// Prevents a Tallier from submitting scores for the same contestant twice in one event
tallySchema.index({ eventId: 1, contestantId: 1, tallierId: 1 }, { unique: true });

module.exports = mongoose.model('Tally', tallySchema);