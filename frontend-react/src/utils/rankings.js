// Event placements earn weighted points toward category and overall standings.
export const RANK_POINTS = { 1: 10, 2: 7, 3: 5, 4: 3, 5: 2, 6: 1 };
export const pointsForRank = (rank) => RANK_POINTS[rank] || 0;

// The public endpoints return different row shapes; map them to one:
// { key, rank, name, value, valueLabel }
export const normalizeEventRows = (leaderboard = []) =>
  leaderboard.map((row) => ({
    key: String(row.contestantId || row.contestantName),
    rank: Number(row.liveRank || row.rank || 0),
    name: row.contestantName,
    value: pointsForRank(Number(row.liveRank || row.rank || 0)),
    valueLabel: 'pts'
  }));

export const normalizeCategoryRows = (rankings = []) =>
  rankings.map((row) => ({
    key: String(row.contestantName),
    rank: Number(row.rank || 0),
    name: row.contestantName,
    value: Number(Number(row.categoryTotalPoints || 0).toFixed(2)),
    valueLabel: 'pts'
  }));

export const normalizeOverallRows = (rankings = []) =>
  rankings.map((row) => ({
    key: String(row.contestantName),
    rank: Number(row.rank || 0),
    name: row.contestantName,
    value: Number(Number(row.weightedTotal || 0).toFixed(2)),
    valueLabel: 'pts'
  }));

export const isLiveBadge = (badge) => badge === 'IN-PROGRESS' || badge === 'LIVE';
