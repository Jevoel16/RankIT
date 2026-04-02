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
    },
    grievances: [
      {
        reason: {
          type: String,
          required: [true, 'Grievance reason is required'],
          trim: true
        },
        deductionPoints: {
          type: Number,
          required: [true, 'Deduction points are required'],
          min: [0, 'Deduction points cannot be negative']
        },
        filedBy: {
          type: String,
          required: [true, 'FiledBy is required'],
          trim: true
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

contestantSchema.index({ eventId: 1, contestantNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Contestant', contestantSchema);