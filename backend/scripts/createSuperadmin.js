// Creates (or resets) the first superadmin in any database, including production Atlas.
// Usage: npm run create:superadmin
// Reads SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD from the environment, otherwise prompts.
const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const ask = (question, { hidden = false } = {}) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Echo nothing while the password is typed.
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required (backend/.env or environment).');
  }

  const baseName = (process.env.SUPERADMIN_USERNAME || (await ask('Superadmin username (without @domain): ')))
    .split('@')[0]
    .toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(baseName)) {
    throw new Error('Username must be 3-40 characters: letters, numbers, dots, dashes or underscores.');
  }

  const password = process.env.SUPERADMIN_PASSWORD || (await ask('Password (min 12 characters): ', { hidden: true }));
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const username = `${baseName}@superadmin.rankit`;
  await User.updateOne(
    { username },
    {
      $set: {
        username,
        password: await bcrypt.hash(password, 12),
        role: 'superadmin',
        isApproved: true,
        approvalStatus: 'approved'
      },
      $inc: { tokenVersion: 1 }
    },
    { upsert: true }
  );
  console.log(`Superadmin ready: ${username}`);
}

main()
  .catch((error) => {
    console.error(`Failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
