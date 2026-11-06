const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  // Hashed. Optional only for accounts that sign in with a linked Google/GitHub identity.
  password: {
    type: String,
    required() {
      return !(this.oauth?.google?.providerId || this.oauth?.github?.providerId);
    }
  },
  oauth: {
    google: { providerId: String, email: String },
    github: { providerId: String, login: String }
  },
  role: {
    type: String,
    enum: ['tabulator', 'grievance', 'admin', 'superadmin'],
    default: 'tabulator'
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Pre-save middleware to ensure username format (username@role.rankit)
userSchema.pre('save', function(next) {
  if (this.isModified('username') || this.isNew) {
    const baseUsername = this.username.split('@')[0].toLowerCase();
    const domainFormat = `${baseUsername}@${this.role}.rankit`;
    this.username = domainFormat;
  }
  if (typeof next === 'function') {
    next();
  }
});

// One RankIT account per external identity.
for (const provider of ['google', 'github']) {
  const path = `oauth.${provider}.providerId`;
  userSchema.index({ [path]: 1 }, { unique: true, partialFilterExpression: { [path]: { $type: 'string' } } });
}

module.exports = mongoose.model('User', userSchema);