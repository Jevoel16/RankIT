// Sports bracket standings shown to the tabulator. Moved unchanged from TabulatorPage so the
// rules are testable: pregame round robin -> Top 4 pairings -> Top 3 (bronze) and Top 1 (final).

export const SPORTS_STAGES = [
  { id: 'pregame', label: 'Pregame' },
  { id: 'top4', label: 'Top 4' },
  { id: 'top3', label: 'Top 3 match' },
  { id: 'top1', label: 'Top 1 match' }
];

export const stageLabel = (stage) => SPORTS_STAGES.find((item) => item.id === stage)?.label || 'Pregame';

export function stageMatches(bracket, stage) {
  if (!bracket) return [];
  if (stage === 'top4') return bracket.top4Matches || [];
  if (stage === 'top3') return bracket.top3Matches || [];
  if (stage === 'top1') return bracket.top1Matches || [];
  return [];
}

export const hasTop4Pairings = (sportsState) =>
  Array.isArray(sportsState?.bracket?.top4Matches) && sportsState.bracket.top4Matches.length > 0;

const byWinsThenLosses = (winsKey, lossesKey) => (a, b) => {
  if (Number(b[winsKey] || 0) !== Number(a[winsKey] || 0)) return Number(b[winsKey] || 0) - Number(a[winsKey] || 0);
  if (Number(a[lossesKey] || 0) !== Number(b[lossesKey] || 0))
    return Number(a[lossesKey] || 0) - Number(b[lossesKey] || 0);
  return String(a.contestantName || '').localeCompare(String(b.contestantName || ''));
};

// Top 7 teams by pregame wins (fewest losses, then name, break ties).
export function buildPregameRows(sportsState) {
  const standings = Array.isArray(sportsState?.standings) ? sportsState.standings : [];
  const pregameMatches = Array.isArray(sportsState?.bracket?.pregameMatches) ? sportsState.bracket.pregameMatches : [];

  const byId = new Map();
  standings.forEach((row) => {
    byId.set(String(row.contestantId || ''), {
      contestantId: row.contestantId,
      contestantName: row.contestantName,
      pregameWins: 0,
      pregameLosses: 0
    });
  });

  pregameMatches.forEach((match) => {
    const teamAId = String(match.teamAContestantId || '');
    const teamBId = String(match.teamBContestantId || '');
    const winnerId = String(match.winnerContestantId || '');
    if (!byId.has(teamAId) || !byId.has(teamBId) || !winnerId) return;

    const teamA = byId.get(teamAId);
    const teamB = byId.get(teamBId);
    if (winnerId === teamAId) {
      teamA.pregameWins += 1;
      teamB.pregameLosses += 1;
    } else if (winnerId === teamBId) {
      teamB.pregameWins += 1;
      teamA.pregameLosses += 1;
    }
  });

  return [...byId.values()]
    .sort(byWinsThenLosses('pregameWins', 'pregameLosses'))
    .slice(0, 7)
    .map((row, index) => ({
      rank: index + 1,
      contestantId: row.contestantId,
      contestantName: row.contestantName,
      pregameWins: Number(row.pregameWins || 0),
      losses: Number(row.pregameLosses || 0)
    }));
}

// Ranks 1-4 come from the Top 1 / Top 3 results (falling back to Top 4 seeding while
// matches are pending); ranks 5-7 are the best remaining pregame teams.
export function buildOfficialRanking(sportsState, stage) {
  const pregameRows = buildPregameRows(sportsState);

  if (stage === 'pregame' && !hasTop4Pairings(sportsState)) {
    return pregameRows.map((row) => ({
      rank: row.rank,
      contestantId: row.contestantId,
      contestantName: row.contestantName,
      win: row.pregameWins,
      loss: row.losses
    }));
  }

  const standings = Array.isArray(sportsState?.standings) ? sportsState.standings : [];
  const byId = new Map(
    standings.map((row) => [
      String(row.contestantId || ''),
      {
        contestantId: row.contestantId,
        contestantName: row.contestantName,
        win: Number(row.totalWins || row.wins || 0),
        loss: Number(row.losses || 0)
      }
    ])
  );

  const top4Matches = Array.isArray(sportsState?.bracket?.top4Matches) ? sportsState.bracket.top4Matches : [];
  const top3Match = (sportsState?.bracket?.top3Matches || [])[0] || null;
  const top1Match = (sportsState?.bracket?.top1Matches || [])[0] || null;

  const topFourSeedIds = (() => {
    if (top4Matches.length > 0) {
      const ids = [];
      top4Matches.forEach((match) => {
        const a = String(match.teamAContestantId || '');
        const b = String(match.teamBContestantId || '');
        if (a && !ids.includes(a)) ids.push(a);
        if (b && !ids.includes(b)) ids.push(b);
      });
      if (ids.length >= 4) return ids.slice(0, 4);
    }
    return pregameRows.slice(0, 4).map((row) => String(row.contestantId || ''));
  })();

  const seedIndex = new Map(topFourSeedIds.map((id, index) => [id, index]));
  const sortBySeed = (a, b) => (seedIndex.get(a) ?? 999) - (seedIndex.get(b) ?? 999);
  const rankAssignments = new Map();

  const assignPair = (match, winnerRank) => {
    if (!match) return;
    const teams = [String(match.teamAContestantId || ''), String(match.teamBContestantId || '')].filter(Boolean);
    const winnerId = String(match.winnerContestantId || '');
    if (winnerId) {
      rankAssignments.set(winnerRank, winnerId);
      const loserId = teams.find((id) => id !== winnerId);
      if (loserId) rankAssignments.set(winnerRank + 1, loserId);
    } else {
      const ordered = [...teams].sort(sortBySeed);
      if (ordered[0]) rankAssignments.set(winnerRank, ordered[0]);
      if (ordered[1]) rankAssignments.set(winnerRank + 1, ordered[1]);
    }
  };

  assignPair(top1Match, 1);
  assignPair(top3Match, 3);

  const takenIds = new Set([...rankAssignments.values()]);
  const remainingTopFour = topFourSeedIds.filter((id) => id && !takenIds.has(id)).sort(sortBySeed);
  [1, 2, 3, 4].forEach((rankNumber) => {
    if (!rankAssignments.has(rankNumber) && remainingTopFour.length > 0) {
      rankAssignments.set(rankNumber, remainingTopFour.shift());
    }
  });

  const topFourRows = [1, 2, 3, 4]
    .map((rankNumber) => {
      const row = byId.get(String(rankAssignments.get(rankNumber) || ''));
      return row ? { rank: rankNumber, ...row } : null;
    })
    .filter(Boolean);

  const topFourIdSet = new Set(topFourSeedIds.map((id) => String(id || '')));
  const nonTopFourRows = pregameRows
    .filter((row) => !topFourIdSet.has(String(row.contestantId || '')))
    .sort(byWinsThenLosses('pregameWins', 'losses'))
    .slice(0, 3)
    .map((row, index) => ({
      rank: index + 5,
      contestantId: row.contestantId,
      contestantName: row.contestantName,
      win: Number(row.pregameWins || 0),
      loss: Number(row.losses || 0)
    }));

  return [...topFourRows, ...nonTopFourRows]
    .filter((row) => row.rank >= 1 && row.rank <= 7)
    .sort((a, b) => a.rank - b.rank);
}
