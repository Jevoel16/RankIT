import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchContestants,
  fetchEvents,
  fetchEventScores,
  fetchMasterEventResults,
  generateSportsTop4Pairings,
  recordOfflineScore
} from '../api';
import { useActiveEvent } from '../hooks/useActiveEvent';
import { useAuth } from '../hooks/useAuth';
import ScoreInputCard from '../components/ScoreInputCard';
import MasterReportPreviewModal from '../components/MasterReportPreviewModal';

export default function TabulatorPage() {
  const { token, user } = useAuth();
  const { activeEventId, setActiveEvent } = useActiveEvent();
  const { eventId: eventIdFromRoute } = useParams();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeTab, setActiveTab] = useState('scores');
  const [unlockState, setUnlockState] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [contestants, setContestants] = useState([]);
  const [selectedContestantId, setSelectedContestantId] = useState('');
  const [physicalJudgeName, setPhysicalJudgeName] = useState('Judge 1');
  const [scoreDraft, setScoreDraft] = useState({});
  const [sportsScoreDraft, setSportsScoreDraft] = useState({});
  const [sportsStage, setSportsStage] = useState('pregame');
  const [sportsMatchNumber, setSportsMatchNumber] = useState(1);
  const [sportsTeamAId, setSportsTeamAId] = useState('');
  const [sportsTeamBId, setSportsTeamBId] = useState('');
  const [sportsState, setSportsState] = useState({ standings: [], bracket: null, topFour: [] });
  const [pairingLoading, setPairingLoading] = useState(false);
  const [recordedScores, setRecordedScores] = useState([]);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingSaving, setRecordingSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [reportPreviewData, setReportPreviewData] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uiStateHydrated, setUiStateHydrated] = useState(false);

  const tabulatorUiStorageKey = useMemo(
    () => `rankit.tabulator.ui.${String(user?._id || user?.username || 'anon')}`,
    [user]
  );

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId) || null,
    [events, selectedEventId]
  );
  const judgeOptions = useMemo(() => {
    const requiredJudges = Math.max(1, Number(selectedEvent?.requiredTalliers || 1));
    return Array.from({ length: requiredJudges }, (_, index) => `Judge ${index + 1}`);
  }, [selectedEvent]);
  const isSportsEvent = selectedEvent?.category === 'Sports Events Category';
  const sportsContestants = useMemo(() => (isSportsEvent ? contestants : []), [contestants, isSportsEvent]);
  const sportsStageMatches = useMemo(() => {
    if (!sportsState?.bracket) return [];
    if (sportsStage === 'top4') return sportsState.bracket.top4Matches || [];
    if (sportsStage === 'top3') return sportsState.bracket.top3Matches || [];
    if (sportsStage === 'top1') return sportsState.bracket.top1Matches || [];
    return [];
  }, [sportsStage, sportsState]);
  const selectedSportsMatch = useMemo(
    () => sportsStageMatches.find((item) => Number(item.matchNumber) === Number(sportsMatchNumber)) || null,
    [sportsStageMatches, sportsMatchNumber]
  );
  const hasTop4Pairings = useMemo(
    () => Array.isArray(sportsState?.bracket?.top4Matches) && sportsState.bracket.top4Matches.length > 0,
    [sportsState]
  );
  const pregameRankingRows = useMemo(() => {
    const standings = Array.isArray(sportsState?.standings) ? sportsState.standings : [];
    const pregameMatches = Array.isArray(sportsState?.bracket?.pregameMatches)
      ? sportsState.bracket.pregameMatches
      : [];

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
      .sort((a, b) => {
        if (Number(b.pregameWins || 0) !== Number(a.pregameWins || 0)) {
          return Number(b.pregameWins || 0) - Number(a.pregameWins || 0);
        }
        if (Number(a.pregameLosses || 0) !== Number(b.pregameLosses || 0)) {
          return Number(a.pregameLosses || 0) - Number(b.pregameLosses || 0);
        }
        return String(a.contestantName || '').localeCompare(String(b.contestantName || ''));
      })
      .slice(0, 7)
      .map((row, index) => ({
        rank: index + 1,
        contestantId: row.contestantId,
        contestantName: row.contestantName,
        pregameWins: Number(row.pregameWins || 0),
        losses: Number(row.pregameLosses || 0)
      }));
  }, [sportsState]);
  const officialFinalRankingRows = useMemo(() => {
    if (sportsStage === 'pregame' && !hasTop4Pairings) {
      return pregameRankingRows.map((row) => ({
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

      return pregameRankingRows.slice(0, 4).map((row) => String(row.contestantId || ''));
    })();

    const seedIndex = new Map(topFourSeedIds.map((id, index) => [id, index]));
    const sortBySeed = (a, b) => (seedIndex.get(a) ?? 999) - (seedIndex.get(b) ?? 999);
    const rankAssignments = new Map();

    if (top1Match) {
      const finalistA = String(top1Match.teamAContestantId || '');
      const finalistB = String(top1Match.teamBContestantId || '');
      const finalists = [finalistA, finalistB].filter(Boolean);

      if (String(top1Match.winnerContestantId || '')) {
        const winnerId = String(top1Match.winnerContestantId || '');
        const loserId = finalists.find((id) => id !== winnerId);
        rankAssignments.set(1, winnerId);
        if (loserId) rankAssignments.set(2, loserId);
      } else {
        const ordered = [...finalists].sort(sortBySeed);
        if (ordered[0]) rankAssignments.set(1, ordered[0]);
        if (ordered[1]) rankAssignments.set(2, ordered[1]);
      }
    }

    if (top3Match) {
      const bronzeA = String(top3Match.teamAContestantId || '');
      const bronzeB = String(top3Match.teamBContestantId || '');
      const bronzeTeams = [bronzeA, bronzeB].filter(Boolean);

      if (String(top3Match.winnerContestantId || '')) {
        const winnerId = String(top3Match.winnerContestantId || '');
        const loserId = bronzeTeams.find((id) => id !== winnerId);
        rankAssignments.set(3, winnerId);
        if (loserId) rankAssignments.set(4, loserId);
      } else {
        const ordered = [...bronzeTeams].sort(sortBySeed);
        if (ordered[0]) rankAssignments.set(3, ordered[0]);
        if (ordered[1]) rankAssignments.set(4, ordered[1]);
      }
    }

    const takenIds = new Set([...rankAssignments.values()]);
    const remainingTopFour = topFourSeedIds.filter((id) => id && !takenIds.has(id)).sort(sortBySeed);
    [1, 2, 3, 4].forEach((rankNumber) => {
      if (!rankAssignments.has(rankNumber) && remainingTopFour.length > 0) {
        rankAssignments.set(rankNumber, remainingTopFour.shift());
      }
    });

    const topFourRows = [1, 2, 3, 4]
      .map((rankNumber) => {
        const contestantId = rankAssignments.get(rankNumber);
        if (!contestantId) return null;
        const row = byId.get(String(contestantId));
        if (!row) return null;

        return {
          rank: rankNumber,
          contestantId: row.contestantId,
          contestantName: row.contestantName,
          win: row.win,
          loss: row.loss
        };
      })
      .filter(Boolean);

    const topFourIdSet = new Set(topFourSeedIds.map((id) => String(id || '')));
    const nonTopFourRows = pregameRankingRows
      .filter((row) => !topFourIdSet.has(String(row.contestantId || '')))
      .sort((a, b) => {
        if (Number(b.pregameWins || 0) !== Number(a.pregameWins || 0)) {
          return Number(b.pregameWins || 0) - Number(a.pregameWins || 0);
        }
        if (Number(a.losses || 0) !== Number(b.losses || 0)) {
          return Number(a.losses || 0) - Number(b.losses || 0);
        }
        return String(a.contestantName || '').localeCompare(String(b.contestantName || ''));
      })
      .slice(0, 3)
      .map((row, index) => ({
        rank: index + 5,
        contestantId: row.contestantId,
        contestantName: row.contestantName,
        win: Number(row.pregameWins || 0),
        loss: Number(row.losses || 0)
      }));

    return [...topFourRows, ...nonTopFourRows]
      .filter((row) => Number(row.rank || 0) >= 1 && Number(row.rank || 0) <= 7)
      .sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0));
  }, [sportsStage, hasTop4Pairings, pregameRankingRows, sportsState]);

  const loadEvents = async () => {
    const data = await fetchEvents(token);
    setEvents(data);
    if (data.length > 0) {
      const matched = eventIdFromRoute && data.some((item) => item._id === eventIdFromRoute);
      const fromActiveContext = activeEventId && data.some((item) => item._id === activeEventId);
      const fallbackId = matched ? eventIdFromRoute : fromActiveContext ? activeEventId : data[0]._id;
      setSelectedEventId((prev) => (data.some((item) => item._id === prev) ? prev : fallbackId));
    } else {
      setSelectedEventId('');
    }
  };

  const onGenerateMasterReport = async () => {
    if (!selectedEventId) {
      setError('Select an event before generating the master report.');
      return;
    }

    try {
      setPdfLoading(true);
      setError('');
      const reportData = await fetchMasterEventResults(selectedEventId, token);
      setReportPreviewData(reportData);
      setPreviewOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        await loadEvents();
      } catch (err) {
        setError(err.message);
      }
    }

    init();
  }, [token, eventIdFromRoute, activeEventId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(tabulatorUiStorageKey);
      if (!raw) {
        setUiStateHydrated(true);
        return;
      }

      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        if (saved.activeTab === 'scores' || saved.activeTab === 'print') {
          setActiveTab(saved.activeTab);
        }
        if (typeof saved.selectedEventId === 'string') {
          setSelectedEventId(saved.selectedEventId);
        }
        if (typeof saved.selectedContestantId === 'string') {
          setSelectedContestantId(saved.selectedContestantId);
        }
        if (typeof saved.physicalJudgeName === 'string') {
          setPhysicalJudgeName(saved.physicalJudgeName);
        }
        if (saved.sportsStage === 'pregame' || saved.sportsStage === 'top4' || saved.sportsStage === 'top3' || saved.sportsStage === 'top1') {
          setSportsStage(saved.sportsStage);
        }

        const parsedMatchNumber = Number(saved.sportsMatchNumber);
        if (Number.isFinite(parsedMatchNumber) && parsedMatchNumber >= 1) {
          setSportsMatchNumber(parsedMatchNumber);
        }

        if (typeof saved.sportsTeamAId === 'string') {
          setSportsTeamAId(saved.sportsTeamAId);
        }
        if (typeof saved.sportsTeamBId === 'string') {
          setSportsTeamBId(saved.sportsTeamBId);
        }

        if (saved.scoreDraft && typeof saved.scoreDraft === 'object') {
          setScoreDraft(saved.scoreDraft);
        }

        if (saved.sportsScoreDraft && typeof saved.sportsScoreDraft === 'object') {
          setSportsScoreDraft(saved.sportsScoreDraft);
        }
      }
    } catch {
      // Ignore malformed localStorage payloads and continue with defaults.
    } finally {
      setUiStateHydrated(true);
    }
  }, [tabulatorUiStorageKey]);

  useEffect(() => {
    if (!uiStateHydrated) return;

    try {
      localStorage.setItem(
        tabulatorUiStorageKey,
        JSON.stringify({
          activeTab,
          selectedEventId,
          selectedContestantId,
          physicalJudgeName,
          scoreDraft,
          sportsScoreDraft,
          sportsStage,
          sportsMatchNumber,
          sportsTeamAId,
          sportsTeamBId
        })
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [
    uiStateHydrated,
    tabulatorUiStorageKey,
    activeTab,
    selectedEventId,
    selectedContestantId,
    physicalJudgeName,
    scoreDraft,
    sportsScoreDraft,
    sportsStage,
    sportsMatchNumber,
    sportsTeamAId,
    sportsTeamBId
  ]);

  useEffect(() => {
    let active = true;

    async function loadRecordingData() {
      if (!selectedEventId) {
        setContestants([]);
        setRecordedScores([]);
        setSelectedContestantId('');
        setScoreDraft({});
        setSportsScoreDraft({});
        return;
      }

      try {
        setRecordingLoading(true);
        const [contestantData, scoreData] = await Promise.all([
          fetchContestants(selectedEventId, token),
          fetchEventScores(selectedEventId, token)
        ]);

        if (!active) return;

        setContestants(contestantData || []);
        setRecordedScores(scoreData?.records || []);
        setRankings(scoreData?.rankings || []);
        setUnlockState(scoreData?.unlockState || null);
        setSportsState({
          standings: scoreData?.sports?.standings || [],
          bracket: scoreData?.sports?.bracket || null,
          topFour: scoreData?.sports?.topFour || []
        });

        if (selectedEvent?.category === 'Sports Events Category') {
          setSelectedContestantId('');
        } else {
          setSelectedContestantId((prev) =>
            (contestantData || []).some((item) => item._id === prev) ? prev : (contestantData || [])[0]?._id || ''
          );
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setRecordingLoading(false);
        }
      }
    }

    loadRecordingData();

    return () => {
      active = false;
    };
  }, [selectedEventId, token, selectedEvent]);

  useEffect(() => {
    if (!selectedEvent?.criteria || selectedEvent.criteria.length === 0) {
      return;
    }

    if (isSportsEvent) {
      const nextDraft = {};
      sportsContestants.forEach((contestant) => {
        nextDraft[contestant._id] = {};
        selectedEvent.criteria.forEach((criterion) => {
          nextDraft[contestant._id][criterion.label] = 0;
        });
      });
      setSportsScoreDraft(nextDraft);
      setSportsTeamAId((prev) => (sportsContestants.some((item) => item._id === prev) ? prev : sportsContestants[0]?._id || ''));
      setSportsTeamBId((prev) => {
        if (sportsContestants.some((item) => item._id === prev) && prev !== (sportsContestants[0]?._id || '')) {
          return prev;
        }
        return sportsContestants[1]?._id || sportsContestants[0]?._id || '';
      });
      return;
    }

    const draft = {};
    selectedEvent.criteria.forEach((criterion) => {
      draft[criterion.label] = 0;
    });
    setScoreDraft(draft);
  }, [selectedEvent, isSportsEvent, sportsContestants]);

  useEffect(() => {
    if (!judgeOptions.includes(physicalJudgeName)) {
      setPhysicalJudgeName(judgeOptions[0] || 'Judge 1');
    }
  }, [judgeOptions, physicalJudgeName]);

  useEffect(() => {
    if (!isSportsEvent) return;

    if (hasTop4Pairings && sportsStage === 'pregame') {
      setSportsStage('top4');
      return;
    }

    if (sportsStage === 'top3' || sportsStage === 'top1') {
      setSportsMatchNumber(1);
      return;
    }

    if (sportsStage === 'top4') {
      const availableMatchNumbers = sportsStageMatches.map((item) => Number(item.matchNumber)).filter(Boolean);
      if (availableMatchNumbers.length === 0) {
        setSportsMatchNumber(1);
      } else if (!availableMatchNumbers.includes(Number(sportsMatchNumber))) {
        setSportsMatchNumber(availableMatchNumbers[0]);
      }
    }
  }, [isSportsEvent, sportsStage, sportsMatchNumber, sportsStageMatches]);

  useEffect(() => {
    if (!isSportsEvent) return;

    if (sportsStage === 'pregame') {
      return;
    }

    if (selectedSportsMatch) {
      setSportsTeamAId(String(selectedSportsMatch.teamAContestantId || ''));
      setSportsTeamBId(String(selectedSportsMatch.teamBContestantId || ''));
    }
  }, [isSportsEvent, sportsStage, selectedSportsMatch]);

  const eventName = useMemo(
    () => events.find((event) => event._id === selectedEventId)?.name || 'Selected Event',
    [events, selectedEventId]
  );

  const setDraftScore = (label, value) => {
    setScoreDraft((prev) => ({
      ...prev,
      [label]: value
    }));
  };

  const onRecordOfflineScore = async (event) => {
    event.preventDefault();
    if (!isSportsEvent && !String(physicalJudgeName || '').trim()) {
      setError('Judge name is required.');
      return;
    }

    const criteria = selectedEvent?.criteria || [];
    if (!selectedEventId) {
      setError('Select an event before recording scores.');
      return;
    }

    if (isSportsEvent) {
      if (sportsContestants.length < 2) {
        setError('Sports events require at least two teams to record a match.');
        return;
      }

      if (sportsStage === 'pregame' && hasTop4Pairings) {
        setError('Pregame ranking is locked after Top-4 pairings are generated. Continue scoring in Top 4, Top 3, or Top 1 stages.');
        return;
      }

      if (!sportsTeamAId || !sportsTeamBId) {
        setError('Select two teams for the sports match.');
        return;
      }

      if (sportsTeamAId === sportsTeamBId) {
        setError('Team A and Team B must be different.');
        return;
      }

      if ((sportsStage === 'top4' || sportsStage === 'top3' || sportsStage === 'top1') && !selectedSportsMatch) {
        setError('Generate or complete bracket pairings before recording playoff matches.');
        return;
      }

      const selectedTeams = sportsContestants.filter(
        (item) => item._id === sportsTeamAId || item._id === sportsTeamBId
      );

      if (selectedTeams.length !== 2) {
        setError('Selected teams are invalid for this event.');
        return;
      }

      const contestantScores = selectedTeams.map((contestant) => ({
        contestantId: contestant._id,
        scores: criteria.map((criterion) => ({
          criteriaName: criterion.label,
          value: Number(sportsScoreDraft[contestant._id]?.[criterion.label] ?? 0)
        }))
      }));

      for (const contestantEntry of contestantScores) {
        for (const criterion of criteria) {
          const value = Number(sportsScoreDraft[contestantEntry.contestantId]?.[criterion.label] ?? 0);
          if (!Number.isFinite(value)) {
            setError(`Score for ${criterion.label} must be a valid number.`);
            return;
          }
        }
      }

      setRecordingSaving(true);
      setError('');
      setSuccess('');

      try {
        const payload = await recordOfflineScore(
          {
            eventId: selectedEventId,
            contestantScores,
            sportsStage,
            sportsMatchNumber
          },
          token
        );

        setSuccess(payload?.message || 'Sports match recorded.');

        const refreshed = await fetchEventScores(selectedEventId, token);
        setRankings(refreshed.rankings || []);
        setRecordedScores(refreshed.records || []);
        setUnlockState(refreshed.unlockState || unlockState);
        setSportsState({
          standings: refreshed?.sports?.standings || [],
          bracket: refreshed?.sports?.bracket || null,
          topFour: refreshed?.sports?.topFour || []
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setRecordingSaving(false);
      }

      return;
    }

    if (!selectedContestantId) {
      setError('Select an event and contestant before recording scores.');
      return;
    }

    const payloadScores = criteria.map((criterion) => ({
      criteriaName: criterion.label,
      value: Number(scoreDraft[criterion.label] ?? 0)
    }));

    for (const criterion of criteria) {
      const value = Number(scoreDraft[criterion.label] ?? 0);
      if (!Number.isFinite(value) || value < 0 || value > Number(criterion.maxScore || 0)) {
        setError(`Score for ${criterion.label} must be between 0 and ${criterion.maxScore}.`);
        return;
      }
    }

    setRecordingSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = await recordOfflineScore(
        {
          eventId: selectedEventId,
          contestantId: selectedContestantId,
          physicalJudgeName: physicalJudgeName.trim(),
          scores: payloadScores
        },
        token
      );

      setSuccess(payload?.message || 'Offline score recorded.');

      const refreshed = await fetchEventScores(selectedEventId, token);
      setRankings(refreshed.rankings || []);
      setRecordedScores(refreshed.records || []);
      setUnlockState(refreshed.unlockState || unlockState);
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordingSaving(false);
    }
  };

  const onGenerateTop4Pairings = async () => {
    if (!selectedEventId) {
      setError('Select an event first.');
      return;
    }

    setPairingLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = await generateSportsTop4Pairings(selectedEventId, token);
      setSuccess(payload?.message || 'Top-4 pairings generated.');

      const refreshed = await fetchEventScores(selectedEventId, token);
      setRankings(refreshed.rankings || []);
      setRecordedScores(refreshed.records || []);
      setUnlockState(refreshed.unlockState || unlockState);
      setSportsState({
        standings: refreshed?.sports?.standings || [],
        bracket: refreshed?.sports?.bracket || null,
        topFour: refreshed?.sports?.topFour || []
      });
      setSportsStage('top4');
      setSportsMatchNumber(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setPairingLoading(false);
    }
  };

  return (
    <section className="admin-workspace">
      <div className="admin-tabs" role="tablist" aria-label="Tabulator Actions">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'scores' ? 'active' : ''}`}
          onClick={() => setActiveTab('scores')}
        >
          Record Offline Scores
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'print' ? 'active' : ''}`}
          onClick={() => setActiveTab('print')}
        >
          Download Tabulation PDF
        </button>
      </div>

      <section className="panel">

      <label htmlFor="tab-event">Event</label>
      
      <select
        id="tab-event"
        value={selectedEventId}
        onChange={(e) => {
          const nextEventId = e.target.value;
          setSelectedEventId(nextEventId);
          setActiveEvent({ eventId: nextEventId, source: 'tabulator-manual' });
        }}
      >
        {events.map((event) => (
          <option key={event._id} value={event._id}>
            {event.name}
          </option>
        ))}
      </select>

      {activeTab === 'scores' && (
        <div className="tab-content-shell">
          <div className="panel stack tab-content-panel">
            <div className="section-head">
              <h3>Record Offline Scores</h3>
              <span className="muted">
                {isSportsEvent
                  ? 'Tabulator records team-vs-team match outcomes per sports subevent'
                  : 'Tabulator enters one physical judge sheet at a time'}
              </span>
            </div>

            <form onSubmit={onRecordOfflineScore}>
              {isSportsEvent ? (
                <>
                  <div className="sports-controls-grid">
                    <div className="sports-inline-field sports-stage-inline-field">
                      <label htmlFor="sports-stage">Sports Subevent</label>
                      <select
                        id="sports-stage"
                        className="sports-stage-select"
                        value={sportsStage}
                        onChange={(e) => setSportsStage(e.target.value)}
                      >
                        {!hasTop4Pairings && <option value="pregame">Pregame</option>}
                        <option value="top4">Top 4</option>
                        <option value="top3">Top 3 Match</option>
                        <option value="top1">Top 1 Match</option>
                      </select>
                    </div>

                    {sportsStage === 'top4' && (
                      <div className="sports-inline-field sports-top4-inline-field">
                        <label htmlFor="sports-playoff-match-number">Top 4 Match #</label>
                        <select
                          className="sports-top4-select"
                          id="sports-playoff-match-number"
                          value={sportsMatchNumber}
                          onChange={(e) => setSportsMatchNumber(Number(e.target.value))}
                        >
                          {(sportsState?.bracket?.top4Matches || []).map((match) => (
                            <option key={`top4-${match._id}`} value={match.matchNumber}>
                              Match {match.matchNumber}: {match.teamAName} vs {match.teamBName}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="sports-inline-field sports-team-inline-field">
                      <label htmlFor="sports-team-a">Team A</label>
                      <select
                        id="sports-team-a"
                        value={sportsTeamAId}
                        onChange={(e) => setSportsTeamAId(e.target.value)}
                        disabled={sportsContestants.length === 0 || sportsStage !== 'pregame'}
                      >
                        {sportsContestants.length === 0 && <option value="">No teams available</option>}
                        {sportsContestants.map((contestant) => (
                          <option key={`sports-team-a-${contestant._id}`} value={contestant._id}>
                            {contestant.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sports-inline-field sports-team-inline-field">
                      <label htmlFor="sports-team-b">Team B</label>
                      <select
                        id="sports-team-b"
                        value={sportsTeamBId}
                        onChange={(e) => setSportsTeamBId(e.target.value)}
                        disabled={sportsContestants.length === 0 || sportsStage !== 'pregame'}
                      >
                        {sportsContestants.length === 0 && <option value="">No teams available</option>}
                        {sportsContestants.map((contestant) => (
                          <option key={`sports-team-b-${contestant._id}`} value={contestant._id}>
                            {contestant.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(sportsStage === 'top3' || sportsStage === 'top1') && selectedSportsMatch && (
                    <p className="muted" style={{ marginBottom: '10px' }}>
                      Pairing: <strong>{selectedSportsMatch.teamAName}</strong> vs <strong>{selectedSportsMatch.teamBName}</strong>
                    </p>
                  )}

                  {(sportsStage === 'top4' || sportsStage === 'top3' || sportsStage === 'top1') && !selectedSportsMatch && (
                    <p className="muted" style={{ marginBottom: '10px' }}>No bracket pairing available yet for this stage.</p>
                  )}

                  {sportsStage === 'pregame' && (
                    <button type="button" className="ghost-btn sports-pairing-btn" onClick={onGenerateTop4Pairings} disabled={pairingLoading}>
                      {pairingLoading ? 'Generating Top-4...' : 'Generate Random Top-4 Pairings'}
                    </button>
                  )}

                  <div className="sports-main-grid">
                    <div className="sports-column-shell">
                      {sportsContestants.length === 0 && <p className="muted">No contestants available.</p>}

                      {(() => {
                        const teamA = sportsContestants.find((contestant) => contestant._id === sportsTeamAId) || null;
                        const teamB = sportsContestants.find((contestant) => contestant._id === sportsTeamBId) || null;

                        if (!teamA || !teamB) {
                          return <p className="muted">Select Team A and Team B to start scoring.</p>;
                        }

                        const stageLabel = sportsStage === 'pregame'
                          ? 'Pregame'
                          : sportsStage === 'top4'
                            ? 'Top 4'
                            : sportsStage === 'top3'
                              ? 'Top 3'
                              : 'Top 1';
                        const resolvedMatchNumber = (sportsStage === 'top3' || sportsStage === 'top1') ? 1 : Number(sportsMatchNumber || 1);

                        return (
                          <div className="criteria-box sports-match-bubble">
                            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                              <strong>
                                {stageLabel} Match #{resolvedMatchNumber}: {teamA.name} {' vs '} {teamB.name}
                              </strong>
                            </div>

                            {(selectedEvent?.criteria || []).map((criterion) => (
                              <div key={`set-row-${criterion.label}`} className="criteria-box sports-set-row">
                                <div style={{ fontWeight: 700, marginBottom: '10px' }}>{criterion.label}</div>
                                <div className="sports-set-score-row">
                                  <input
                                    className="sports-set-score-input"
                                    type="number"
                                    value={sportsScoreDraft[teamA._id]?.[criterion.label] ?? 0}
                                    onChange={(event) => {
                                      const value = Number(event.target.value);
                                      setSportsScoreDraft((prev) => ({
                                        ...prev,
                                        [teamA._id]: {
                                          ...(prev[teamA._id] || {}),
                                          [criterion.label]: value
                                        }
                                      }));
                                    }}
                                  />
                                  <span style={{ fontWeight: 700 }}>-</span>
                                  <input
                                    className="sports-set-score-input"
                                    type="number"
                                    value={sportsScoreDraft[teamB._id]?.[criterion.label] ?? 0}
                                    onChange={(event) => {
                                      const value = Number(event.target.value);
                                      setSportsScoreDraft((prev) => ({
                                        ...prev,
                                        [teamB._id]: {
                                          ...(prev[teamB._id] || {}),
                                          [criterion.label]: value
                                        }
                                      }));
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="sports-column-shell">
                      {officialFinalRankingRows.length > 0 ? (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>{sportsStage === 'pregame' && !hasTop4Pairings ? 'Pregame Rank' : 'Official/Final Rank'}</th>
                                <th>Team</th>
                                <th>Win</th>
                                <th>Loss</th>
                              </tr>
                            </thead>
                            <tbody>
                              {officialFinalRankingRows.map((team) => (
                                <tr key={`sports-rank-${team.contestantId || team.rank}`}>
                                  <td>{team.rank}</td>
                                  <td>{team.contestantName}</td>
                                  <td>{team.win}</td>
                                  <td>{team.loss}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="muted">Ranking will appear here once matches are recorded.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="offline-score-grid">
                  <div className="offline-score-left">
                    <div className="criteria-box">
                      <div className="criteria-header">
                        <strong>Contestant & Judge</strong>
                      </div>

                      <div className="offline-field-bubble">
                        <label htmlFor="offline-contestant">Contestant</label>
                        <select
                          id="offline-contestant"
                          value={selectedContestantId}
                          onChange={(e) => setSelectedContestantId(e.target.value)}
                          disabled={contestants.length === 0}
                        >
                          {contestants.length === 0 && <option value="">No contestants available</option>}
                          {contestants.map((contestant) => (
                            <option key={contestant._id} value={contestant._id}>
                              {contestant.contestantNumber ? `#${contestant.contestantNumber} - ` : ''}
                              {contestant.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {!isSportsEvent && (
                        <>
                          <div className="offline-field-bubble">
                            <label htmlFor="physical-judge-name">Physical Judge</label>
                            <select
                              id="physical-judge-name"
                              value={physicalJudgeName}
                              onChange={(e) => setPhysicalJudgeName(e.target.value)}
                              required
                            >
                              {judgeOptions.map((judgeName) => (
                                <option key={judgeName} value={judgeName}>
                                  {judgeName}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="offline-score-right">
                    <div className="criteria-box offline-score-sheet-box">
                      <div className="criteria-header">
                        <strong>Score Sheet</strong>
                      </div>
                      {(selectedEvent?.criteria || []).map((criterion) => (
                        <ScoreInputCard
                          key={criterion.label}
                          criterion={criterion}
                          value={scoreDraft[criterion.label] ?? 0}
                          onChange={(value) => setDraftScore(criterion.label, value)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

                <button
                  type="submit"
                  disabled={recordingSaving || !selectedEventId || (!isSportsEvent && !selectedContestantId)}
                >
                  {recordingSaving ? 'Recording...' : 'Record Offline Score'}
                </button>
              </form>

            {recordedScores.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Subevent</th>
                      <th>Contestant</th>
                      <th>Total Score</th>
                      <th>Winner</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordedScores.map((row) => (
                      <tr key={row._id}>
                        <td>{row.stage ? `${String(row.stage).toUpperCase()} #${row.matchNumber || 1}` : '-'}</td>
                        <td>{row.contestantName}</td>
                        <td>{typeof row.totalScore === 'number' ? Number(row.totalScore || 0).toFixed(2) : (row.totalScore || '-')}</td>
                        <td>{row.winnerName || '-'}</td>
                        <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {success && <p className="success">{success}</p>}
          </div>
        </div>
      )}

      {activeTab === 'print' && (
        <div className="tab-content-shell">
          <div className="panel stack tab-content-panel">
            <div className="section-head">
              <h3>Download Tabulation PDF</h3>
              <span className="muted">Preview and download current event master report</span>
            </div>

            <p className="muted">
              Generate a download-ready master report for <strong>{eventName}</strong>.
            </p>
            <button type="button" className="ghost-btn no-print" onClick={onGenerateMasterReport} disabled={pdfLoading}>
              {pdfLoading ? 'Preparing Master Report...' : 'Preview Master Report'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <MasterReportPreviewModal
        open={previewOpen}
        reportData={reportPreviewData}
        onClose={() => setPreviewOpen(false)}
      />
      </section>
    </section>
  );
}
