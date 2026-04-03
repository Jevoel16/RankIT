const mongoose = require('mongoose');

const sportsMatchSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },
    stage: {
      type: String,
      enum: ['pregame', 'top4', 'top3', 'top1'],
      default: 'pregame',
      index: true
    },
    matchNumber: {
      type: Number,
      required: true,
      min: 1
    },
    teamAContestantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contestant',
      required: true
    },
    teamBContestantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contestant',
      required: true
    },
    teamAScore: {
      type: Number,
      default: null
    },
    teamBScore: {
      type: Number,
      default: null
    },
    winnerContestantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contestant',
      default: null
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    physicalJudgeName: {
      type: String,
      trim: true,
      default: ''
    },
    playedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

sportsMatchSchema.index({ eventId: 1, stage: 1, matchNumber: 1 }, { unique: true });

module.exports = mongoose.model('SportsMatch', sportsMatchSchema);
