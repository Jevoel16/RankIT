import { useEffect, useMemo, useState } from 'react';
import { generateSportsTop4Pairings, recordOfflineScore } from '../../api';
import { Button, DataTable, EmptyState, FormField, useToast } from '../../components/ui';
import {
  SPORTS_STAGES,
  buildOfficialRanking,
  hasTop4Pairings,
  stageLabel,
  stageMatches
} from '../../utils/sportsRankings';

const emptyScores = (criteria) => Object.fromEntries(criteria.map((criterion) => [criterion.label, 0]));

// Records a match between two teams set by set and shows the live bracket standings.
export default function SportsMatchForm({ event, contestants, sports, onRecorded }) {
  const toast = useToast();
  const criteria = useMemo(() => event?.criteria || [], [event]);
  const pairingsReady = hasTop4Pairings(sports);
  const [stage, setStage] = useState(pairingsReady ? 'top4' : 'pregame');
  const [matchNumber, setMatchNumber] = useState(1);
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [scoresA, setScoresA] = useState(() => emptyScores(criteria));
  const [scoresB, setScoresB] = useState(() => emptyScores(criteria));
  const [saving, setSaving] = useState(false);
  const [pairing, setPairing] = useState(false);

  // Pregame is closed once Top 4 pairings exist.
  useEffect(() => {
    if (pairingsReady && stage === 'pregame') setStage('top4');
  }, [pairingsReady, stage]);

  const matches = stageMatches(sports.bracket, stage);
  const isPlayoff = stage !== 'pregame';
  const currentMatch = isPlayoff
    ? matches.find((match) => Number(match.matchNumber) === Number(stage === 'top4' ? matchNumber : 1)) || matches[0]
    : null;

  // Playoff teams come from the bracket; pregame teams are picked freely (defaults fill in
  // once contestants load).
  const isTeam = (id) => contestants.some((item) => item._id === id);
  const pregameA = isTeam(teamAId) ? teamAId : contestants[0]?._id || '';
  const pregameB =
    isTeam(teamBId) && teamBId !== pregameA ? teamBId : contestants.find((item) => item._id !== pregameA)?._id || '';
  const teamA = isPlayoff ? String(currentMatch?.teamAContestantId || '') : pregameA;
  const teamB = isPlayoff ? String(currentMatch?.teamBContestantId || '') : pregameB;
  const nameOf = (id) => contestants.find((item) => item._id === id)?.name || 'Team';

  const ranking = useMemo(() => buildOfficialRanking(sports, stage), [sports, stage]);

  const resetScores = () => {
    setScoresA(emptyScores(criteria));
    setScoresB(emptyScores(criteria));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!teamA || !teamB || teamA === teamB) {
      toast.error('Pick two different teams.');
      return;
    }
    setSaving(true);
    try {
      const toScores = (values) =>
        criteria.map((criterion) => ({ criteriaName: criterion.label, value: Number(values[criterion.label] || 0) }));
      const result = await recordOfflineScore({
        eventId: event._id,
        contestantScores: [
          { contestantId: teamA, scores: toScores(scoresA) },
          { contestantId: teamB, scores: toScores(scoresB) }
        ],
        sportsStage: stage,
        sportsMatchNumber: stage === 'top4' ? matchNumber : 1
      });
      toast.success(result?.message || 'Match recorded.');
      resetScores();
      onRecorded?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const generatePairings = async () => {
    setPairing(true);
    try {
      const result = await generateSportsTop4Pairings(event._id);
      toast.success(result?.message || 'Top 4 pairings generated.');
      setStage('top4');
      setMatchNumber(1);
      onRecorded?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPairing(false);
    }
  };

  if (contestants.length < 2) {
    return <EmptyState title="Not enough teams">A sports event needs at least two teams.</EmptyState>;
  }

  const teamSelect = (label, value, onChange) => (
    <FormField label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={isPlayoff}>
        {contestants.map((contestant) => (
          <option key={contestant._id} value={contestant._id}>
            {contestant.name}
          </option>
        ))}
      </select>
    </FormField>
  );

  return (
    <div className="sports-layout">
      <form className="score-form" onSubmit={submit}>
        <div className="score-form__meta">
          <FormField label="Stage">
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              {SPORTS_STAGES.filter((item) => !(pairingsReady && item.id === 'pregame')).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </FormField>
          {stage === 'top4' && (
            <FormField label="Match">
              <select value={matchNumber} onChange={(e) => setMatchNumber(Number(e.target.value))}>
                {matches.map((match) => (
                  <option key={match._id || match.matchNumber} value={match.matchNumber}>
                    Match {match.matchNumber}: {match.teamAName} vs {match.teamBName}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          {teamSelect('Team A', teamA, setTeamAId)}
          {teamSelect('Team B', teamB, setTeamBId)}
        </div>

        {isPlayoff && !currentMatch ? (
          <EmptyState title={`No ${stageLabel(stage)} pairing yet`}>
            Finish the previous stage first; pairings appear automatically.
          </EmptyState>
        ) : (
          <fieldset className="score-form__sheet sets-sheet">
            <legend>
              {stageLabel(stage)}: {nameOf(teamA)} vs {nameOf(teamB)}
            </legend>
            <div className="sets-sheet__head" aria-hidden="true">
              <span>Set</span>
              <span>{nameOf(teamA)}</span>
              <span>{nameOf(teamB)}</span>
            </div>
            {criteria.map((criterion) => (
              <div className="sets-sheet__row" key={criterion.label}>
                <span>{criterion.label}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`${criterion.label} points for ${nameOf(teamA)}`}
                  value={scoresA[criterion.label] ?? 0}
                  onChange={(e) => setScoresA((prev) => ({ ...prev, [criterion.label]: Number(e.target.value) }))}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`${criterion.label} points for ${nameOf(teamB)}`}
                  value={scoresB[criterion.label] ?? 0}
                  onChange={(e) => setScoresB((prev) => ({ ...prev, [criterion.label]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </fieldset>
        )}

        <div className="score-form__footer">
          {stage === 'pregame' && (
            <Button variant="ghost" loading={pairing} onClick={generatePairings}>
              Generate Top 4 pairings
            </Button>
          )}
          <Button type="submit" variant="primary" size="lg" loading={saving} disabled={isPlayoff && !currentMatch}>
            Record match
          </Button>
        </div>
      </form>

      <section className="sports-layout__standings" aria-label="Standings">
        <h3>{stage === 'pregame' && !pairingsReady ? 'Pregame standings' : 'Official standings'}</h3>
        <DataTable
          caption="Standings"
          rows={ranking}
          rowKey={(row) => row.contestantId || row.rank}
          emptyTitle="No matches yet"
          columns={[
            { key: 'rank', header: 'Rank', render: (row) => <strong>#{row.rank}</strong> },
            { key: 'contestantName', header: 'Team' },
            { key: 'win', header: 'W', align: 'right' },
            { key: 'loss', header: 'L', align: 'right' }
          ]}
        />
      </section>
    </div>
  );
}
