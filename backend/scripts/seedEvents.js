const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const User = require('../models/User');
const Event = require('../models/Event');
const Contestant = require('../models/Contestant');
const ScoreSheet = require('../models/ScoreSheet');
const SportsMatch = require('../models/SportsMatch');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const STANDARD_CONTESTANTS = ['CCS', 'CSM', 'COE', 'CASS', 'CHS', 'CED-IDS', 'CEBA'];

const EVENT_BLUEPRINTS = [
  {
    name: 'Mass Dance Showcase',
    category: 'Special Events Category',
    scoringMode: 'criteria',
    requiredTalliers: 3,
    criteria: [
      { label: 'Technique', description: 'Control, precision, and execution', maxScore: 10, weight: 35 },
      { label: 'Creativity', description: 'Originality and style choices', maxScore: 10, weight: 30 },
      { label: 'Stage Presence', description: 'Confidence and audience impact', maxScore: 10, weight: 35 }
    ],
    contestantNames: STANDARD_CONTESTANTS
  },
  {
    name: 'Debate Showcase',
    category: 'Literary Events Category',
    scoringMode: 'criteria',
    requiredTalliers: 3,
    criteria: [
      { label: 'Content', description: 'Argument quality and depth', maxScore: 100, weight: 35 },
      { label: 'Delivery', description: 'Clarity, pace, and confidence', maxScore: 100, weight: 35 },
      { label: 'Rebuttal', description: 'Responsiveness and counter-argument skill', maxScore: 100, weight: 30 }
    ],
    contestantNames: STANDARD_CONTESTANTS
  },
  {
    name: 'Poetry Recitation',
    category: 'Literary Events Category',
    scoringMode: 'criteria',
    requiredTalliers: 3,
    criteria: [
      { label: 'Content', description: 'Theme, structure, and message', maxScore: 10, weight: 40 },
      { label: 'Delivery', description: 'Voice, pacing, and confidence', maxScore: 10, weight: 30 },
      { label: 'Impact', description: 'Audience effect and memorability', maxScore: 10, weight: 30 }
    ],
    contestantNames: STANDARD_CONTESTANTS
  },
  {
    name: 'Sports Skills Challenge',
    category: 'Sports Events Category',
    scoringMode: 'sets',
    requiredTalliers: 1,
    setCount: 3,
    contestantNames: STANDARD_CONTESTANTS
  }
];

function buildSetCriteria(eventName, setCount) {
  const parsedSetCount = Math.max(1, Number(setCount) || 1);
  const baseWeight = Math.floor(10000 / parsedSetCount) / 100;

  return Array.from({ length: parsedSetCount }, (_, index) => {
    const isLast = index === parsedSetCount - 1;
    const weight = isLast
      ? Number((100 - baseWeight * (parsedSetCount - 1)).toFixed(2))
      : baseWeight;

    return {
      label: `Set ${index + 1}`,
      description: `${eventName} set ${index + 1}`,
      maxScore: 25,
      weight
    };
  });
}

async function seedEvents() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const approvedTabulators = await User.find({
    role: 'tabulator',
    isApproved: true,
    approvalStatus: 'approved'
  })
    .select('_id username')
    .lean();

  await Promise.all([
    SportsMatch.deleteMany({}),
    ScoreSheet.deleteMany({}),
    Contestant.deleteMany({}),
    Event.deleteMany({})
  ]);

  for (const [index, blueprint] of EVENT_BLUEPRINTS.entries()) {
    const assignedTabulator = approvedTabulators[index % approvedTabulators.length];
    const criteria = blueprint.scoringMode === 'sets'
      ? buildSetCriteria(blueprint.name, blueprint.setCount || 3)
      : blueprint.criteria;

    const event = await Event.create({
      name: blueprint.name,
      category: blueprint.category,
      scoringMode: blueprint.scoringMode,
      setCount: blueprint.scoringMode === 'sets' ? (blueprint.setCount || criteria.length) : null,
      criteria,
      requiredTalliers: blueprint.requiredTalliers,
      completedTalliers: 0,
      status: 'locked',
      eventStatus: 'live',
      communityVisible: true,
      tabulatorId: assignedTabulator?._id || null,
      assignedTallierIds: []
    });

    const contestants = (blueprint.contestantNames || []).map((name, rowIndex) => ({
      name,
      eventId: event._id,
      contestantNumber: rowIndex + 1
    }));

    if (contestants.length > 0) {
      await Contestant.insertMany(contestants);
    }
  }

  console.log('Seed completed: Events, contestants, and score records reset.');
  console.log(`- Events: ${EVENT_BLUEPRINTS.length}`);
  console.log('- Categories: Special Events Category, Literary Events Category, Sports Events Category');
  console.log(`- Approved tabulators found: ${approvedTabulators.length}`);

  if (approvedTabulators.length === 0) {
    console.log('- Note: no approved tabulator accounts found; events were created with no tabulator assignment.');
    console.log('- Run `npm run seed:users --prefix backend` first to generate tabulator accounts.');
  } else {
    console.log(`- Assigned tabulators: ${approvedTabulators.map((user) => user.username).join(', ')}`);
  }
}

seedEvents()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
