// One-off migration to OAuth-only accounts (v3.0.0). Safe to run more than once.
// - name@role.rankit usernames become plain names (a number is added on clashes)
// - approvalStatus pending -> role "pending"; rejected -> disabled
// - removes isApproved / approvalStatus and signs everyone out (tokenVersion + 1)
// Usage: npm run migrate:accounts -- [--dry-run]
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const DRY_RUN = process.argv.includes('--dry-run');
const LEGACY_SUFFIX = /@[a-z]+\.rankit$/;

const cleanName = (username) =>
  String(username)
    .toLowerCase()
    .replace(LEGACY_SUFFIX, '')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 34) || 'user';

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required (backend/.env or environment).');
  await mongoose.connect(process.env.MONGODB_URI);
  // Raw collection: the legacy fields are no longer in the Mongoose schema.
  const users = mongoose.connection.collection('users');

  const all = await users.find({}, { projection: { username: 1, role: 1, isApproved: 1, approvalStatus: 1 } }).toArray();
  const taken = new Set(all.filter((u) => !LEGACY_SUFFIX.test(u.username)).map((u) => u.username));
  const summary = { renamed: 0, pending: 0, disabled: 0, unchanged: 0 };

  for (const user of all) {
    const set = {};
    const unset = {};

    if (LEGACY_SUFFIX.test(user.username)) {
      const base = cleanName(user.username);
      let candidate = base;
      for (let i = 2; taken.has(candidate); i += 1) candidate = `${base}${i}`;
      taken.add(candidate);
      set.username = candidate;
      summary.renamed += 1;
    }

    const legacy = 'approvalStatus' in user || 'isApproved' in user;
    if (legacy) {
      const status = user.approvalStatus || (user.isApproved ? 'approved' : 'pending');
      if (status === 'rejected') {
        set.disabled = true;
        summary.disabled += 1;
      } else {
        set.disabled = false;
        if (status === 'pending' && user.role !== 'superadmin') {
          set.role = 'pending';
          summary.pending += 1;
        }
      }
      unset.isApproved = '';
      unset.approvalStatus = '';
    }

    if (!Object.keys(set).length && !Object.keys(unset).length) {
      summary.unchanged += 1;
      continue;
    }

    console.log(`${user.username} -> ${set.username || user.username}${set.role ? ' (pending)' : ''}${set.disabled ? ' (disabled)' : ''}`);
    if (!DRY_RUN) {
      const update = { $set: set, $inc: { tokenVersion: 1 } };
      if (Object.keys(unset).length) update.$unset = unset;
      await users.updateOne({ _id: user._id }, update);
    }
  }

  console.log(`${DRY_RUN ? '[dry run] ' : ''}Summary: ${JSON.stringify(summary)}`);
}

main()
  .catch((error) => {
    console.error(`Failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
