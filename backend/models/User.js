const mongoose = require('mongoose');

// 'pending' = signed up through Google/GitHub but no role assigned by an admin yet.
const ROLES = ['pending', 'tabulator', 'grievance', 'admin', 'superadmin'];
const ASSIGNABLE_ROLES = ['tabulator', 'grievance', 'admin'];

const userSchema = new mongoose.Schema(
  {
    // The Google/GitHub username, made unique with a number suffix on clashes.
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9._-]{1,40}$/
    },
    // Hashed. Unset until the user finishes the password step after their first OAuth sign-in.
    password: String,
    oauth: {
      google: { providerId: String, email: String },
      github: { providerId: String, login: String }
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'pending'
    },
    // Rejected sign-ups stay disabled so the same identity can't sign up again.
    disabled: {
      type: Boolean,
      default: false
    },
    tokenVersion: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// One RankIT account per external identity.
for (const provider of ['google', 'github']) {
  const path = `oauth.${provider}.providerId`;
  userSchema.index({ [path]: 1 }, { unique: true, partialFilterExpression: { [path]: { $type: 'string' } } });
}

// Can this account use the app right now?
const isActive = (user) =>
  Boolean(user) && !user.disabled && Boolean(user.password) && ROLES.includes(user.role) && user.role !== 'pending';

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
module.exports.ASSIGNABLE_ROLES = ASSIGNABLE_ROLES;
module.exports.isActive = isActive;
