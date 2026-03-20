const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const usersToSeed = [
  { username: 'superadmin1', role: 'superadmin', isApproved: true, approvalStatus: 'approved' },
  { username: 'admin1', role: 'admin', isApproved: true, approvalStatus: 'approved' },
  { username: 'tabulator1', role: 'tabulator', isApproved: true, approvalStatus: 'approved' },
  { username: 'tallier1', role: 'tallier', isApproved: true, approvalStatus: 'approved' },
  { username: 'pending1', role: 'tallier', isApproved: false, approvalStatus: 'pending' }
];

async function seedUsers() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const hashedPassword = await bcrypt.hash('1234', 10);

  for (const user of usersToSeed) {
    await User.updateOne(
      { username: user.username },
      {
        $set: {
          password: hashedPassword,
          role: user.role,
          isApproved: user.isApproved,
          approvalStatus: user.approvalStatus
        }
      },
      { upsert: true }
    );
  }

  console.log('Seeded users (password for all: 1234):');
  usersToSeed.forEach((user) => {
    console.log(`- ${user.username} (${user.role}) status=${user.approvalStatus}`);
  });
}

seedUsers()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
