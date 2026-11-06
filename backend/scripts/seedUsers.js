const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { assertLocalDatabase } = require('./guard');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

// Local demo accounts. Real accounts are created by signing in with Google/GitHub.
const usersToSeed = [
  { username: 'jevoel', role: 'superadmin' },
  { username: 'mark', role: 'admin' },
  { username: 'al', role: 'tabulator' },
  { username: 'kibra', role: 'grievance' },
  { username: 'jheo', role: 'tabulator' },
  { username: 'quinit', role: 'tabulator' },
  { username: 'francis', role: 'tabulator' },
  { username: 'phil', role: 'pending' },
  { username: 'rossmir', role: 'pending' }
];

async function seedUsers() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in backend/.env');
  }

  assertLocalDatabase(process.env.MONGODB_URI);
  await mongoose.connect(process.env.MONGODB_URI);
  // Demo password for local development only; override with SEED_PASSWORD.
  const hashedPassword = await bcrypt.hash(process.env.SEED_PASSWORD || '1234', 12);

  for (const user of usersToSeed) {
    await User.updateOne(
      { username: user.username },
      { $set: { username: user.username, password: hashedPassword, role: user.role, disabled: false } },
      { upsert: true }
    );
  }

  console.log('Seeded users (shared demo password, see README):');
  usersToSeed.forEach((user) => console.log(`- ${user.username} (${user.role})`));
}

seedUsers()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Seed error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
