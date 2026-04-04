const mongoose = require('mongoose');

const scoreItemSchema = new mongoose.Schema(
  {
    criteriaName: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: Number,
      required: true
    }
  },
  {
    _id: false
  }
);

const scoreSheetSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },
    contestantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contestant',
      required: true,
      index: true
    },
    tallierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    filedOfflineBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    physicalJudgeName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    scores: {
      type: [scoreItemSchema],
      default: []
    },
    totalScore: {
      type: Number,
      required: true,
      default: 0,
      index: true
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'scoresheets'
  }
);

scoreSheetSchema.index(
  { eventId: 1, contestantId: 1, physicalJudgeName: 1 },
  { unique: true, name: 'uniq_event_contestant_judge_score_sheet' }
);

module.exports = mongoose.model('ScoreSheet', scoreSheetSchema);