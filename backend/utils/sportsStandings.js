const Contestant = require('../models/Contestant');
const SportsMatch = require('../models/SportsMatch');

const SPORTS_STAGES = ['pregame', 'top4', 'top3', 'top1'];

const normalizeSportsStage = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return SPORTS_STAGES.includes(normalized) ? normalized : 'pregame';
};

const sortByPerformance = (a, b) => {
  if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
  if (b.pregameWins !== a.pregameWins) return b.pregameWins - a.pregameWins;
  if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
  if ((a.contestantNumber || 0) !== (b.contestantNumber || 0)) {
    return (a.contestantNumber || 0) - (b.contestantNumber || 0);
  }
  return String(a.contestantName || '').localeCompare(String(b.contestantName || ''));
};

const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const buildSportsStandings = async (eventId) => {
  const [contestants, matches] = await Promise.all([
    Contestant.find({ eventId })
      .select('_id name contestantNumber')
      .sort({ contestantNumber: 1, name: 1 })
      .lean(),
    SportsMatch.find({ eventId }).sort({ stage: 1, matchNumber: 1, createdAt: 1 }).lean()
  ]);

  const statsByContestant = new Map();

  contestants.forEach((contestant) => {
    const id = contestant._id.toString();
    statsByContestant.set(id, {
      contestantId: contestant._id,
      contestantName: contestant.name,
      contestantNumber: contestant.contestantNumber || null,
      totalWins: 0,
      pregameWins: 0,
      playoffWins: 0,
      losses: 0,
      matchesPlayed: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      scoreDiff: 0,
      latestSubmittedAt: null
    });
  });

  matches.forEach((match) => {
    const teamAId = String(match.teamAContestantId || '');
    const teamBId = String(match.teamBContestantId || '');

    if (!statsByContestant.has(teamAId) || !statsByContestant.has(teamBId)) {
      return;
    }

    const teamA = statsByContestant.get(teamAId);
    const teamB = statsByContestant.get(teamBId);

    const teamAScore = Number(match.teamAScore);
    const teamBScore = Number(match.teamBScore);
    const hasScores = Number.isFinite(teamAScore) && Number.isFinite(teamBScore);

    if (!hasScores) {
      return;
    }

    teamA.matchesPlayed += 1;
    teamB.matchesPlayed += 1;
    teamA.pointsFor += teamAScore;
    teamA.pointsAgainst += teamBScore;
    teamB.pointsFor += teamBScore;
    teamB.pointsAgainst += teamAScore;

    const winnerId = String(match.winnerContestantId || '');
    const stage = normalizeSportsStage(match.stage);

    if (winnerId === teamAId) {
      teamA.totalWins += 1;
      teamB.losses += 1;
      if (stage === 'pregame') teamA.pregameWins += 1;
      else teamA.playoffWins += 1;
    } else if (winnerId === teamBId) {
      teamB.totalWins += 1;
      teamA.losses += 1;
      if (stage === 'pregame') teamB.pregameWins += 1;
      else teamB.playoffWins += 1;
    }

    const playedAt = match.playedAt || match.updatedAt || match.createdAt || null;
    if (playedAt) {
      if (!teamA.latestSubmittedAt || new Date(playedAt) > new Date(teamA.latestSubmittedAt)) {
        teamA.latestSubmittedAt = playedAt;
      }
      if (!teamB.latestSubmittedAt || new Date(playedAt) > new Date(teamB.latestSubmittedAt)) {
        teamB.latestSubmittedAt = playedAt;
      }
    }
  });

  const rows = [...statsByContestant.values()].map((row) => ({
    ...row,
    scoreDiff: Number((row.pointsFor - row.pointsAgainst).toFixed(2)),
    pointsFor: Number(row.pointsFor.toFixed(2)),
    pointsAgainst: Number(row.pointsAgainst.toFixed(2))
  }));

  return {
    contestants,
    matches,
    standings: rows
  };
};

const buildSportsBracket = (matches, contestants) => {
  const byId = new Map(contestants.map((item) => [item._id.toString(), item]));

  const mapMatch = (match) => {
    const teamA = byId.get(String(match.teamAContestantId || ''));
    const teamB = byId.get(String(match.teamBContestantId || ''));
    const winner = byId.get(String(match.winnerContestantId || ''));

    return {
      _id: match._id,
      stage: normalizeSportsStage(match.stage),
      matchNumber: match.matchNumber,
      teamAContestantId: match.teamAContestantId,
      teamAName: teamA?.name || 'Unknown Team',
      teamBContestantId: match.teamBContestantId,
      teamBName: teamB?.name || 'Unknown Team',
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
      winnerContestantId: match.winnerContestantId,
      winnerName: winner?.name || null,
      physicalJudgeName: match.physicalJudgeName || '',
      playedAt: match.playedAt
    };
  };

  return {
    pregameMatches: matches.filter((item) => normalizeSportsStage(item.stage) === 'pregame').map(mapMatch),
    top4Matches: matches.filter((item) => normalizeSportsStage(item.stage) === 'top4').map(mapMatch),
    top3Matches: matches.filter((item) => normalizeSportsStage(item.stage) === 'top3').map(mapMatch),
    top1Matches: matches.filter((item) => normalizeSportsStage(item.stage) === 'top1').map(mapMatch)
  };
};

const buildSportsRankings = ({ standings, matches }) => {
  const sortedBase = [...standings].sort(sortByPerformance);

  const top3Match = matches.find((item) => normalizeSportsStage(item.stage) === 'top3' && item.matchNumber === 1);
  const top1Match = matches.find((item) => normalizeSportsStage(item.stage) === 'top1' && item.matchNumber === 1);
  const finalsComplete = Boolean(top3Match?.winnerContestantId) && Boolean(top1Match?.winnerContestantId);

  const placementOrder = new Map();

  if (finalsComplete) {
    const top1WinnerId = String(top1Match.winnerContestantId);
    const top1LoserId = String(
      String(top1Match.teamAContestantId) === top1WinnerId ? top1Match.teamBContestantId : top1Match.teamAContestantId
    );

    const top3WinnerId = String(top3Match.winnerContestantId);
    const top3LoserId = String(
      String(top3Match.teamAContestantId) === top3WinnerId ? top3Match.teamBContestantId : top3Match.teamAContestantId
    );

    placementOrder.set(top1WinnerId, 1);
    placementOrder.set(top1LoserId, 2);
    placementOrder.set(top3WinnerId, 3);
    placementOrder.set(top3LoserId, 4);
  }

  const placementRows = sortedBase
    .filter((row) => placementOrder.has(String(row.contestantId)))
    .sort((a, b) => placementOrder.get(String(a.contestantId)) - placementOrder.get(String(b.contestantId)))
    .map((row) => ({ ...row, liveRank: placementOrder.get(String(row.contestantId)) }));

  const unplacedRows = sortedBase.filter((row) => !placementOrder.has(String(row.contestantId)));

  let nextRank = finalsComplete ? 5 : 1;
  let previousScore = null;

  const rankedUnplaced = unplacedRows.map((row, index) => {
    if (!finalsComplete) {
      const comparable = `${row.totalWins}|${row.pregameWins}|${row.scoreDiff}`;
      if (previousScore === null || comparable !== previousScore) {
        nextRank = index + 1;
        previousScore = comparable;
      }
    }

    const rankToUse = finalsComplete ? nextRank + index : nextRank;

    return {
      ...row,
      liveRank: rankToUse
    };
  });

  const finalRows = [...placementRows, ...rankedUnplaced].sort((a, b) => a.liveRank - b.liveRank);

  return finalRows.map((row) => ({
    contestantId: row.contestantId,
    contestantName: row.contestantName,
    contestantNumber: row.contestantNumber,
    liveRank: row.liveRank,
    averageScore: row.totalWins,
    totalScore: row.totalWins,
    rawAverageScore: row.totalWins,
    finalScore: row.totalWins,
    deductionPoints: 0,
    submissions: row.matchesPlayed,
    wins: row.totalWins,
    pregameWins: row.pregameWins,
    playoffWins: row.playoffWins,
    losses: row.losses,
    matchesPlayed: row.matchesPlayed,
    scoreDiff: row.scoreDiff,
    latestSubmittedAt: row.latestSubmittedAt
  }));
};

const getTopFourFromPregame = (standings) => {
  return [...standings]
    .sort((a, b) => {
      if (b.pregameWins !== a.pregameWins) return b.pregameWins - a.pregameWins;
      if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
      if ((a.contestantNumber || 0) !== (b.contestantNumber || 0)) return (a.contestantNumber || 0) - (b.contestantNumber || 0);
      return String(a.contestantName).localeCompare(String(b.contestantName));
    })
    .slice(0, 4);
};

module.exports = {
  SPORTS_STAGES,
  normalizeSportsStage,
  shuffle,
  buildSportsStandings,
  buildSportsBracket,
  buildSportsRankings,
  getTopFourFromPregame
};
