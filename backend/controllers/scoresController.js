const ScoreSheet = require('../models/ScoreSheet');
const Event = require('../models/Event');
const Contestant = require('../models/Contestant');
const Audit = require('../models/Audit');
const SportsMatch = require('../models/SportsMatch');
const { computeGatekeeperState } = require('./eventController');
const {
  normalizeSportsStage,
  buildSportsStandings,
  buildSportsBracket,
  buildSportsRankings,
  getTopFourFromPregame,
  shuffle
} = require('../utils/sportsStandings');

const writeAudit = async ({ action, actorId, eventId, entityType, entityId, metadata }) => {
  try {
    await Audit.create({ action, actorId, eventId, entityType, entityId, metadata });
  } catch (_error) {
    // Logging failures should not block score entry.
  }
};

const normalizeScoreValue = (value, maxScore) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('Each score must be a valid number.');
  }

  return Number(numeric.toFixed(2));
};

const mapSubmittedScores = (criteria, submittedScores) => {
  const normalized = [];

  for (const criterion of criteria) {
    const submitted = (submittedScores || []).find((item) => String(item.criteriaName || '').trim() === String(criterion.label || '').trim());

    if (!submitted) {
      throw new Error(`Missing score for ${criterion.label}.`);
    }

    normalized.push({
      criteriaName: criterion.label,
      value: normalizeScoreValue(submitted.value, Number(criterion.maxScore || 0))
    });
  }

  return normalized;
};

const validateSportsSubmittedScores = (criteria, submittedScores) => {
  for (const criterion of criteria) {
    const submitted = (submittedScores || []).find((item) => String(item.criteriaName || '').trim() === String(criterion.label || '').trim());

    if (!submitted) {
      throw new Error(`Missing score for ${criterion.label}.`);
    }

    const numeric = Number(submitted.value);
    if (!Number.isFinite(numeric)) {
      throw new Error(`Score for ${criterion.label} must be a valid number.`);
    }
  }
};

const createScoreRecord = async ({ event, contestant, judgeName, submittedScores, actorId }) => {
  const criteria = Array.isArray(event.criteria) ? event.criteria : [];
  const normalizedScores = mapSubmittedScores(criteria, submittedScores);
  const totalScore = normalizedScores.reduce((sum, item) => sum + Number(item.value || 0), 0);

  const record = await ScoreSheet.create({
    eventId: event._id,
    contestantId: contestant._id,
    tallierId: actorId,
    filedOfflineBy: actorId,
    physicalJudgeName: judgeName,
    scores: normalizedScores,
    totalScore
  });

  await writeAudit({
    action: 'OFFLINE_SCORE_RECORDED',
    actorId,
    eventId: event._id,
    entityType: 'scoreSheet',
    entityId: record._id,
    metadata: {
      contestantId: contestant._id,
      physicalJudgeName: judgeName,
      totalScore: record.totalScore,
      scoreCount: normalizedScores.length
    }
  });

  return record;
};

const sumSubmittedScores = (scores = []) => {
  return (scores || []).reduce((sum, item) => sum + Number(item?.value || 0), 0);
};

const createOrUpdateSportsMatch = async ({
  event,
  contestants,
  contestantScores,
  judgeName,
  actorId,
  requestedStage,
  requestedMatchNumber
}) => {
  const stage = normalizeSportsStage(requestedStage);
  const [first, second] = contestantScores;
  const firstId = String(first.contestantId);
  const secondId = String(second.contestantId);

  if (!firstId || !secondId || firstId === secondId) {
    throw new Error('Sports match recording requires two different teams.');
  }

  const contestantA = contestants.find((item) => String(item._id) === firstId);
  const contestantB = contestants.find((item) => String(item._id) === secondId);
  if (!contestantA || !contestantB) {
    throw new Error('Selected teams must belong to the current event.');
  }

  const scoreA = Number(sumSubmittedScores(first.scores).toFixed(2));
  const scoreB = Number(sumSubmittedScores(second.scores).toFixed(2));

  if (scoreA === scoreB) {
    throw new Error('Tie scores are not allowed for sports match results.');
  }

  const winnerContestantId = scoreA > scoreB ? contestantA._id : contestantB._id;
  const loserContestantId = scoreA > scoreB ? contestantB._id : contestantA._id;
  let matchNumber = Number(requestedMatchNumber || 0);

  if (stage === 'pregame') {
    if (!Number.isFinite(matchNumber) || matchNumber < 1) {
      const latest = await SportsMatch.findOne({ eventId: event._id, stage }).sort({ matchNumber: -1 }).lean();
      matchNumber = Number(latest?.matchNumber || 0) + 1;
    }

    const existing = await SportsMatch.findOne({ eventId: event._id, stage, matchNumber });
    if (existing) {
      throw new Error(`Pregame match #${matchNumber} already exists.`);
    }

    const createdMatch = await SportsMatch.create({
      eventId: event._id,
      stage,
      matchNumber,
      teamAContestantId: contestantA._id,
      teamBContestantId: contestantB._id,
      teamAScore: scoreA,
      teamBScore: scoreB,
      winnerContestantId,
      recordedBy: actorId,
      physicalJudgeName: judgeName,
      playedAt: new Date()
    });

    return { createdMatch, winnerContestantId, loserContestantId };
  }

  if (stage === 'top3' || stage === 'top1') {
    matchNumber = 1;
  }

  if (!Number.isFinite(matchNumber) || matchNumber < 1) {
    throw new Error('A valid match number is required for playoff stages.');
  }

  const existingMatch = await SportsMatch.findOne({ eventId: event._id, stage, matchNumber });
  if (!existingMatch) {
    throw new Error('Playoff match is not yet created. Generate top-4 pairings first.');
  }

  const expected = [String(existingMatch.teamAContestantId), String(existingMatch.teamBContestantId)].sort();
  const supplied = [firstId, secondId].sort();
  if (expected[0] !== supplied[0] || expected[1] !== supplied[1]) {
    throw new Error('Selected teams do not match this playoff bracket pairing.');
  }

  const firstMatchesTeamA = String(existingMatch.teamAContestantId) === firstId;
  existingMatch.teamAScore = firstMatchesTeamA ? scoreA : scoreB;
  existingMatch.teamBScore = firstMatchesTeamA ? scoreB : scoreA;
  existingMatch.winnerContestantId = winnerContestantId;
  existingMatch.recordedBy = actorId;
  existingMatch.physicalJudgeName = judgeName;
  existingMatch.playedAt = new Date();
  await existingMatch.save();

  return { createdMatch: existingMatch, winnerContestantId, loserContestantId };
};

const ensureTop3AndTop1Matches = async (eventId) => {
  const top4Matches = await SportsMatch.find({ eventId, stage: 'top4' }).sort({ matchNumber: 1 }).lean();
  if (top4Matches.length < 2) return;

  const winners = [];
  const losers = [];

  top4Matches.forEach((match) => {
    if (!match.winnerContestantId) return;
    const winner = String(match.winnerContestantId);
    const loser = String(match.teamAContestantId) === winner
      ? String(match.teamBContestantId)
      : String(match.teamAContestantId);
    winners.push(winner);
    losers.push(loser);
  });

  if (winners.length !== 2 || losers.length !== 2) return;

  const existingTop1 = await SportsMatch.findOne({ eventId, stage: 'top1', matchNumber: 1 }).lean();
  if (!existingTop1) {
    await SportsMatch.create({
      eventId,
      stage: 'top1',
      matchNumber: 1,
      teamAContestantId: winners[0],
      teamBContestantId: winners[1]
    });
  }

  const existingTop3 = await SportsMatch.findOne({ eventId, stage: 'top3', matchNumber: 1 }).lean();
  if (!existingTop3) {
    await SportsMatch.create({
      eventId,
      stage: 'top3',
      matchNumber: 1,
      teamAContestantId: losers[0],
      teamBContestantId: losers[1]
    });
  }
};

const buildSportsState = async (eventId) => {
  const { contestants, matches, standings } = await buildSportsStandings(eventId);
  const rankings = buildSportsRankings({ standings, matches });
  const bracket = buildSportsBracket(matches, contestants);
  const topFour = getTopFourFromPregame(standings).map((item, index) => ({
    rank: index + 1,
    contestantId: item.contestantId,
    contestantName: item.contestantName,
    contestantNumber: item.contestantNumber,
    pregameWins: item.pregameWins,
    scoreDiff: item.scoreDiff
  }));

  return {
    rankings,
    standings,
    bracket,
    topFour
  };
};

const buildRankings = async (eventId) => {
  const event = await Event.findById(eventId).select('category');
  if (event?.category === 'Sports Events Category') {
    const state = await buildSportsState(eventId);
    return state.rankings;
  }

  const contestants = await Contestant.aggregate([
    {
      $match: { eventId }
    },
    {
      $lookup: {
        from: 'scoresheets',
        let: { contestantId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$contestantId', '$$contestantId'] },
                  { $eq: ['$eventId', eventId] }
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              totalScore: { $sum: '$totalScore' },
              averageScore: { $avg: '$totalScore' },
              submissions: { $sum: 1 },
              latestSubmittedAt: { $max: '$submittedAt' }
            }
          }
        ],
        as: 'stats'
      }
    },
    {
      $unwind: {
        path: '$stats',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $addFields: {
        totalScore: { $ifNull: ['$stats.totalScore', 0] },
        averageScore: { $ifNull: ['$stats.averageScore', 0] },
        submissions: { $ifNull: ['$stats.submissions', 0] },
        latestSubmittedAt: '$stats.latestSubmittedAt',
        deductionPoints: {
          $sum: {
            $map: {
              input: { $ifNull: ['$grievances', []] },
              as: 'entry',
              in: { $ifNull: ['$$entry.deductionPoints', 0] }
            }
          }
        }
      }
    },
    {
      $addFields: {
        adjustedAverageScore: { $subtract: ['$averageScore', '$deductionPoints'] },
        adjustedTotalScore: { $subtract: ['$totalScore', '$deductionPoints'] }
      }
    },
    {
      $sort: {
        adjustedAverageScore: -1,
        adjustedTotalScore: -1,
        contestantNumber: 1,
        name: 1
      }
    },
    {
      $setWindowFields: {
        sortBy: {
          adjustedAverageScore: -1
        },
        output: {
          liveRank: {
            $denseRank: {}
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        contestantId: '$_id',
        contestantName: '$name',
        contestantNumber: 1,
        liveRank: 1,
        averageScore: { $round: ['$adjustedAverageScore', 2] },
        totalScore: { $round: ['$adjustedTotalScore', 2] },
        deductionPoints: { $round: ['$deductionPoints', 2] },
        submissions: 1,
        latestSubmittedAt: 1
      }
    },
    {
      $sort: {
        liveRank: 1,
        averageScore: -1,
        contestantNumber: 1,
        contestantName: 1
      }
    }
  ]);

  return contestants;
};

const recordOfflineScore = async (req, res) => {
  try {
    const {
      eventId,
      contestantId,
      physicalJudgeName,
      scores,
      contestantScores,
      sportsStage,
      sportsMatchNumber
    } = req.body;

    const [event, contestant] = await Promise.all([
      Event.findById(eventId),
      contestantId ? Contestant.findById(contestantId) : Promise.resolve(null)
    ]);

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.eventStatus === 'finalized') {
      return res.status(403).json({ message: 'Cannot record scores: Event has been finalized.' });
    }

    const judgeName = String(physicalJudgeName || '').trim();

    if (Array.isArray(contestantScores) && contestantScores.length > 0) {
      if (event.category !== 'Sports Events Category') {
        return res.status(400).json({ message: 'Batch contestant score recording is only available for sports events.' });
      }

      const contestantIds = contestantScores.map((item) => item?.contestantId).filter(Boolean);
      if (contestantIds.length < 2) {
        return res.status(400).json({ message: 'Two contestant scores are required for sports events.' });
      }

      if (contestantIds.length > 2) {
        return res.status(400).json({ message: 'Sports match recording only accepts two teams per match.' });
      }

      const contestants = await Contestant.find({ _id: { $in: contestantIds }, eventId: event._id });
      if (contestants.length !== contestantIds.length) {
        return res.status(400).json({ message: 'All selected contestants must belong to the selected event.' });
      }

      for (const item of contestantScores) {
        validateSportsSubmittedScores(event.criteria || [], item.scores || []);
      }

      const { createdMatch } = await createOrUpdateSportsMatch({
        event,
        contestants,
        contestantScores,
        judgeName,
        actorId: req.user._id,
        requestedStage: sportsStage,
        requestedMatchNumber: sportsMatchNumber
      });

      await ensureTop3AndTop1Matches(event._id);

      const sportsState = await buildSportsState(event._id);

      const unlockState = await computeGatekeeperState(event._id);

      return res.status(201).json({
        message: 'Sports match recorded.',
        match: createdMatch,
        unlockState,
        rankings: sportsState.rankings,
        sports: {
          standings: sportsState.standings,
          bracket: sportsState.bracket,
          topFour: sportsState.topFour
        }
      });
    }

    if (!eventId || !contestantId || !judgeName || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({
        message: 'eventId, contestantId, physicalJudgeName, and scores are required.'
      });
    }

    if (!contestant) {
      return res.status(404).json({ message: 'Contestant not found.' });
    }

    if (String(contestant.eventId) !== String(event._id)) {
      return res.status(400).json({ message: 'Contestant does not belong to the selected event.' });
    }

    const existingSheet = await ScoreSheet.findOne({
      eventId: event._id,
      contestantId: contestant._id,
      physicalJudgeName: judgeName
    });

    if (existingSheet) {
      return res.status(409).json({ message: 'A score sheet already exists for this contestant and physical judge.' });
    }

    const record = await createScoreRecord({
      event,
      contestant,
      judgeName,
      submittedScores: scores,
      actorId: req.user._id
    });

    const unlockState = await computeGatekeeperState(event._id);
    const rankings = await buildRankings(event._id);

    return res.status(201).json({
      message: 'Offline score recorded.',
      record,
      unlockState,
      rankings
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const getEventScores = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    const event = await Event.findById(eventId).select('name category criteria requiredTalliers eventStatus status');

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.category === 'Sports Events Category') {
      const [sportsState, unlockState] = await Promise.all([
        buildSportsState(event._id),
        computeGatekeeperState(event._id)
      ]);

      const sportsRecords = [
        ...(sportsState.bracket.pregameMatches || []),
        ...(sportsState.bracket.top4Matches || []),
        ...(sportsState.bracket.top3Matches || []),
        ...(sportsState.bracket.top1Matches || [])
      ]
        .sort((a, b) => {
          const stageOrder = { pregame: 1, top4: 2, top3: 3, top1: 4 };
          if ((stageOrder[b.stage] || 0) !== (stageOrder[a.stage] || 0)) {
            return (stageOrder[b.stage] || 0) - (stageOrder[a.stage] || 0);
          }
          return Number(b.matchNumber || 0) - Number(a.matchNumber || 0);
        })
        .map((match) => ({
          _id: match._id,
          stage: match.stage,
          matchNumber: match.matchNumber,
          physicalJudgeName: match.physicalJudgeName || '-',
          contestantId: null,
          contestantName: `${match.teamAName} vs ${match.teamBName}`,
          contestantNumber: null,
          totalScore: `${Number(match.teamAScore || 0).toFixed(2)} - ${Number(match.teamBScore || 0).toFixed(2)}`,
          submittedAt: match.playedAt || null,
          winnerName: match.winnerName || null
        }));

      return res.json({
        eventId: event._id,
        eventName: event.name,
        criteria: event.criteria || [],
        requiredTalliers: event.requiredTalliers,
        unlockState,
        records: sportsRecords,
        rankings: sportsState.rankings,
        sports: {
          standings: sportsState.standings,
          bracket: sportsState.bracket,
          topFour: sportsState.topFour
        }
      });
    }

    const [records, rankings, unlockState] = await Promise.all([
      ScoreSheet.find({ eventId: event._id })
        .populate('contestantId', 'name contestantNumber')
        .populate('filedOfflineBy', 'username role')
        .sort({ submittedAt: -1 })
        .lean(),
      buildRankings(event._id),
      computeGatekeeperState(event._id)
    ]);

    return res.json({
      eventId: event._id,
      eventName: event.name,
      criteria: event.criteria || [],
      requiredTalliers: event.requiredTalliers,
      unlockState,
      records: records.map((item) => ({
        _id: item._id,
        contestantId: item.contestantId?._id || item.contestantId,
        contestantName: item.contestantId?.name || 'Unknown',
        contestantNumber: item.contestantId?.contestantNumber || null,
        physicalJudgeName: item.physicalJudgeName,
        filedOfflineBy: item.filedOfflineBy?.username || '',
        totalScore: item.totalScore,
        scores: item.scores || [],
        submittedAt: item.submittedAt
      })),
      rankings
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const generateSportsTop4Pairings = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await Event.findById(eventId).select('category eventStatus');

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.category !== 'Sports Events Category') {
      return res.status(400).json({ message: 'Top-4 pairing generation is only available for sports events.' });
    }

    if (event.eventStatus === 'finalized') {
      return res.status(403).json({ message: 'Cannot generate pairings: Event has been finalized.' });
    }

    const existingTop4 = await SportsMatch.find({ eventId, stage: 'top4' }).sort({ matchNumber: 1 }).lean();
    if (existingTop4.length >= 2) {
      const sportsState = await buildSportsState(eventId);
      return res.json({
        message: 'Top-4 pairings already exist.',
        sports: {
          standings: sportsState.standings,
          bracket: sportsState.bracket,
          topFour: sportsState.topFour
        }
      });
    }

    const { standings } = await buildSportsStandings(eventId);
    const topFour = getTopFourFromPregame(standings);

    if (topFour.length < 4) {
      return res.status(400).json({ message: 'At least four teams are required to generate Top-4 pairings.' });
    }

    const randomized = shuffle(topFour);
    const matchesToCreate = [
      {
        eventId,
        stage: 'top4',
        matchNumber: 1,
        teamAContestantId: randomized[0].contestantId,
        teamBContestantId: randomized[1].contestantId
      },
      {
        eventId,
        stage: 'top4',
        matchNumber: 2,
        teamAContestantId: randomized[2].contestantId,
        teamBContestantId: randomized[3].contestantId
      }
    ];

    await SportsMatch.insertMany(matchesToCreate);

    await writeAudit({
      action: 'SPORTS_TOP4_PAIRINGS_GENERATED',
      actorId: req.user._id,
      eventId,
      entityType: 'event',
      entityId: eventId,
      metadata: {
        seededTopFour: topFour.map((item) => ({ contestantId: item.contestantId, name: item.contestantName, pregameWins: item.pregameWins }))
      }
    });

    const sportsState = await buildSportsState(eventId);

    return res.status(201).json({
      message: 'Top-4 pairings generated.',
      sports: {
        standings: sportsState.standings,
        bracket: sportsState.bracket,
        topFour: sportsState.topFour
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getMasterEventResults = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await Event.findById(eventId).select('name criteria requiredTalliers category');

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.category === 'Sports Events Category') {
      const [sportsState, gatekeeper] = await Promise.all([
        buildSportsState(event._id),
        computeGatekeeperState(event._id)
      ]);

      const scoreByRank = {
        1: 10,
        2: 7,
        3: 5,
        4: 3,
        5: 2,
        6: 1,
        7: 0
      };

      const rows = (sportsState.rankings || [])
        .slice(0, 7)
        .map((row) => ({
          contestantId: row.contestantId,
          contestantNumber: row.contestantNumber || null,
          contestantName: row.contestantName,
          rank: Number(row.liveRank || 0),
          wins: Number(row.wins || 0),
          losses: Number(row.losses || 0),
          rankingPoints: Number(scoreByRank[Number(row.liveRank || 0)] ?? 0)
        }))
        .sort((a, b) => a.rank - b.rank);

      return res.json({
        eventId: event._id,
        eventName: event.name,
        category: event.category,
        criteria: [],
        finalized: Boolean(gatekeeper?.unlocked),
        requiredTalliers: event.requiredTalliers,
        completedTalliers: Number(gatekeeper?.currentTallies || 0),
        generatedByName: req.user?.username || 'Unknown User',
        generatedByRole: req.user?.role || 'tabulator',
        generatedAt: new Date().toISOString(),
        isSportsEvent: true,
        rankingScale: scoreByRank,
        rows
      });
    }

    const [contestants, records, gatekeeper] = await Promise.all([
      Contestant.find({ eventId: event._id }).select('name contestantNumber grievances').sort({ contestantNumber: 1, name: 1 }).lean(),
      ScoreSheet.find({ eventId: event._id }).select('contestantId scores physicalJudgeName filedOfflineBy submittedAt totalScore').lean(),
      computeGatekeeperState(event._id)
    ]);

    const criteriaLabels = (event.criteria || []).map((item) => item.label).filter(Boolean);

    const scoreBuckets = new Map();

    records.forEach((record) => {
      const contestantKey = record.contestantId.toString();
      if (!scoreBuckets.has(contestantKey)) {
        scoreBuckets.set(contestantKey, {});
      }

      const contestantScores = scoreBuckets.get(contestantKey);
      (record.scores || []).forEach((score) => {
        if (!score || !score.criteriaName) return;
        if (!contestantScores[score.criteriaName]) {
          contestantScores[score.criteriaName] = [];
        }
        contestantScores[score.criteriaName].push(Number(score.value || 0));
      });
    });

    const rows = contestants.map((contestant) => {
      const contestantKey = contestant._id.toString();
      const perCriterion = scoreBuckets.get(contestantKey) || {};
      const criterionScores = {};
      let totalScore = 0;
      const grievanceEntries = (contestant.grievances || []).map((entry) => ({
        reason: String(entry?.reason || '').trim(),
        deductionPoints: Number(entry?.deductionPoints || 0),
        filedBy: String(entry?.filedBy || '').trim(),
        timestamp: entry?.timestamp || null
      }));
      const deductionPoints = (contestant.grievances || []).reduce(
        (sum, item) => sum + Number(item?.deductionPoints || 0),
        0
      );

      criteriaLabels.forEach((label) => {
        const values = perCriterion[label] || [];
        if (values.length === 0) {
          criterionScores[label] = null;
          return;
        }

        const summedScore = values.reduce((sum, value) => sum + value, 0);
        const roundedSummedScore = Number(summedScore.toFixed(2));
        criterionScores[label] = roundedSummedScore;
        totalScore += roundedSummedScore;
      });

      return {
        contestantId: contestant._id,
        contestantNumber: contestant.contestantNumber || null,
        contestantName: contestant.name,
        criterionScores,
        deductionPoints: Number(deductionPoints.toFixed(2)),
        deductionNotes: grievanceEntries,
        totalScore: Number((totalScore - deductionPoints).toFixed(2)),
        rawTotalScore: Number(totalScore.toFixed(2))
      };
    })
      .sort((a, b) => {
        if (Number(b.totalScore || 0) !== Number(a.totalScore || 0)) {
          return Number(b.totalScore || 0) - Number(a.totalScore || 0);
        }
        if ((a.contestantNumber || 0) !== (b.contestantNumber || 0)) {
          return (a.contestantNumber || 0) - (b.contestantNumber || 0);
        }
        return String(a.contestantName || '').localeCompare(String(b.contestantName || ''));
      })
      .map((row, index) => ({
        ...row,
        rank: index + 1,
        eventScore: [10, 7, 5, 3, 2, 1, 0][index] ?? 0
      }));

    return res.json({
      eventId: event._id,
      eventName: event.name,
      criteria: criteriaLabels,
      finalized: Boolean(gatekeeper?.unlocked),
      requiredTalliers: event.requiredTalliers,
      completedTalliers: Number(gatekeeper?.currentTallies || 0),
      generatedByName: req.user?.username || 'Unknown User',
      generatedByRole: req.user?.role || 'tabulator',
      generatedAt: new Date().toISOString(),
      rows
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  recordOfflineScore,
  getEventScores,
  getMasterEventResults,
  generateSportsTop4Pairings
};
