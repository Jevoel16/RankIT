import { describe, expect, it } from 'vitest';
import { buildOfficialRanking, buildPregameRows, hasTop4Pairings, stageMatches } from './sportsRankings';

const team = (id, name) => ({ contestantId: id, contestantName: name });
const match = (a, b, winner, extra = {}) => ({
  teamAContestantId: a,
  teamBContestantId: b,
  winnerContestantId: winner,
  ...extra
});

const standings = ['a', 'b', 'c', 'd', 'e'].map((id) => team(id, id.toUpperCase()));

describe('buildPregameRows', () => {
  it('ranks by wins, then fewest losses, then name', () => {
    const rows = buildPregameRows({
      standings,
      bracket: {
        pregameMatches: [match('a', 'b', 'a'), match('a', 'c', 'a'), match('d', 'e', 'd'), match('b', 'e', 'b')]
      }
    });
    expect(rows.map((row) => row.contestantId)).toEqual(['a', 'd', 'b', 'c', 'e']);
    expect(rows[0]).toMatchObject({ rank: 1, pregameWins: 2, losses: 0 });
  });

  it('ignores matches without a winner', () => {
    const rows = buildPregameRows({ standings, bracket: { pregameMatches: [match('a', 'b', '')] } });
    expect(rows.every((row) => row.pregameWins === 0)).toBe(true);
  });
});

describe('buildOfficialRanking', () => {
  const bracket = {
    pregameMatches: [match('a', 'e', 'a'), match('b', 'e', 'b'), match('c', 'e', 'c'), match('d', 'e', 'd')],
    top4Matches: [match('a', 'd', 'a', { matchNumber: 1 }), match('b', 'c', 'c', { matchNumber: 2 })],
    top1Matches: [match('a', 'c', 'c')],
    top3Matches: [match('d', 'b', 'b')]
  };

  it('uses pregame order before Top 4 pairings exist', () => {
    const rows = buildOfficialRanking({ standings, bracket: { pregameMatches: bracket.pregameMatches } }, 'pregame');
    expect(rows[rows.length - 1].contestantId).toBe('e');
  });

  it('places final and bronze winners at ranks 1 and 3', () => {
    const rows = buildOfficialRanking({ standings, bracket }, 'top1');
    expect(rows.slice(0, 4).map((row) => row.contestantId)).toEqual(['c', 'a', 'b', 'd']);
    expect(rows[4]).toMatchObject({ rank: 5, contestantId: 'e' });
  });
});

describe('bracket helpers', () => {
  it('detects Top 4 pairings and returns stage matches', () => {
    expect(hasTop4Pairings({ bracket: { top4Matches: [] } })).toBe(false);
    expect(hasTop4Pairings({ bracket: { top4Matches: [{}] } })).toBe(true);
    expect(stageMatches({ top3Matches: [1] }, 'top3')).toEqual([1]);
    expect(stageMatches(null, 'top4')).toEqual([]);
  });
});
