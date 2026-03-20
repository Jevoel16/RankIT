const mongoose = require('mongoose');

const contestantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Contestant name is required'],
      trim: true
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required']
    },
    contestantNumber: {
      type: Number,
      min: [1, 'Contestant number must be at least 1']
    }
  },
  {
    timestamps: true
  }
);

contestantSchema.index({ eventId: 1, contestantNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Contestant', contestantSchema);