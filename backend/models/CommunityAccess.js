const mongoose = require('mongoose');

const communityAccessSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'public-rankings'
    },
    categoryRankingsEnabled: {
      type: Boolean,
      default: true
    },
    overallRankingsEnabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('CommunityAccess', communityAccessSchema);
