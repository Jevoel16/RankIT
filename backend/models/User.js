const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { type: String, required: true }, // Hashed
  role: {
    type: String,
    enum: ['tallier', 'tabulator', 'grievancecommittee', 'admin', 'superadmin'],
    default: 'tallier'
  },
  isApproved: {
    type: Boolean,
    default: false
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

module.exports = mongoose.model('User', userSchema);