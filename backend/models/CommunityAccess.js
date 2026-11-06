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

// Atomic upsert so concurrent first requests can't race to create the singleton twice.
communityAccessSchema.statics.getSingleton = function getSingleton(key = 'public-rankings') {
  return this.findOneAndUpdate(
    { key },
    { $setOnInsert: { key } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('CommunityAccess', communityAccessSchema);
