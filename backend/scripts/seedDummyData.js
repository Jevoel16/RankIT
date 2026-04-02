const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Event = require('../models/Event');
const Contestant = require('../models/Contestant');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const usersToSeed = [
  { username: 'superadmin_demo', role: 'superadmin', isApproved: true, approvalStatus: 'approved' },
  { username: 'admin_demo', role: 'admin', isApproved: true, approvalStatus: 'approved' },
  { username: 'tabulator_demo', role: 'tabulator', isApproved: true, approvalStatus: 'approved' },
  { username: 'grievance_demo', role: 'grievancecommittee', isApproved: true, approvalStatus: 'approved' },
  { username: 'tallier_dance', role: 'tallier', isApproved: true, approvalStatus: 'approved' },
  { username: 'tallier_sing', role: 'tallier', isApproved: true, approvalStatus: 'approved' },
  { username: 'tallier_talent', role: 'tallier', isApproved: true, approvalStatus: 'approved' }
];

const eventsToSeed = [
  {
    name: 'Dancing Showdown',
    category: 'dancing',
    status: 'unlocked',
    requiredTalliers: 3,
    completedTalliers: 0,
    criteria: [
      { label: 'Technique', description: 'Control, precision, and execution', maxScore: 10, weight: 35 },
      { label: 'Creativity', description: 'Originality and style choices', maxScore: 10, weight: 30 },
      { label: 'Stage Presence', description: 'Confidence and audience impact', maxScore: 10, weight: 35 }
    ]
  },
  {
    name: 'Singing Idol',
    category: 'singing',
    status: 'locked',
    requiredTalliers: 3,
    completedTalliers: 0,
    criteria: [
      { label: 'Vocal Quality', description: 'Tone and clarity', maxScore: 10, weight: 40 },
      { label: 'Pitch Accuracy', description: 'Control and consistency', maxScore: 10, weight: 35 },
      { label: 'Interpretation', description: 'Emotion and expression', maxScore: 10, weight: 25 }
    ]
  },
  {
    name: 'Talent Showcase',
    category: 'variety',
    status: 'locked',
    requiredTalliers: 3,
    completedTalliers: 0,
    criteria: [
      { label: 'Difficulty', description: 'Complexity of performance', maxScore: 10, weight: 30 },
      { label: 'Execution', description: 'Accuracy and polish', maxScore: 10, weight: 45 },
      { label: 'Entertainment Value', description: 'Audience engagement', maxScore: 10, weight: 25 }
    ]
  }
];

function buildContestants(eventName, eventId) {
  return Array.from({ length: 10 }, (_, index) => {
    const contestantNumber = index + 1;
    return {
      name: `${eventName} Contestant ${contestantNumber}`,
      eventId,
      contestantNumber
    };
  });
}

async function seedDummyData() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const hashedPassword = await bcrypt.hash('1234', 10);

  for (const user of usersToSeed) {
    const domainUsername = `${user.username.split('@')[0]}@${user.role}.rankit`.toLowerCase();
    await User.updateOne(
      { username: domainUsername },
      {
        $set: {
          username: domainUsername,
          password: hashedPassword,
          role: user.role,
          isApproved: user.isApproved,
          approvalStatus: user.approvalStatus
        }
      },
      { upsert: true }
    );
  }

  for (const eventData of eventsToSeed) {
    const event = await Event.findOneAndUpdate(
      { name: eventData.name },
      {
        $set: {
          category: eventData.category,
          criteria: eventData.criteria,
          requiredTalliers: eventData.requiredTalliers,
          completedTalliers: eventData.completedTalliers,
          status: eventData.status
        }
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const contestants = buildContestants(eventData.name, event._id);

    for (const contestant of contestants) {
      await Contestant.updateOne(
        { eventId: contestant.eventId, contestantNumber: contestant.contestantNumber },
        {
          $set: {
            name: contestant.name,
            eventId: contestant.eventId,
            contestantNumber: contestant.contestantNumber
          }
        },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }
  }

  console.log('Seed completed:');
  console.log('- Users: 7 demo accounts (password: 1234)');
  console.log('- Events: 3 events (including Dancing Showdown)');
  console.log('- Contestants: 10 per event (30 total)');

  console.log('\nDemo users:');
  usersToSeed.forEach((user) => {
    const domainUsername = `${user.username.split('@')[0]}@${user.role}.rankit`.toLowerCase();
    console.log(`- ${domainUsername} (${user.role})`);
  });

  console.log('\nEvents:');
  eventsToSeed.forEach((event) => {
    console.log(`- ${event.name} [${event.category}]`);
  });
}

seedDummyData()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
