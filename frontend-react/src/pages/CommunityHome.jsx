import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicLeaderboard } from '../api';
import { useAuth } from '../hooks/useAuth';

export default function CommunityHome() {
  const { isAuthenticated } = useAuth();
  const [payload, setPayload] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tickerMessage, setTickerMessage] = useState('');

  const latestUpdateRef = useRef('');

  useEffect(() => {
    let active = true;

    async function loadLeaderboard(isInitial = false) {
      if (isInitial) {
        setLoading(true);
      }

      try {
        const nextPayload = await fetchPublicLeaderboard(selectedCategory, selectedEventId);
        if (!active) return;

        const latestStamp = nextPayload?.latestUpdate?.submittedAt || '';
        if (latestStamp && latestUpdateRef.current && latestStamp !== latestUpdateRef.current) {
          setTickerMessage(nextPayload.latestUpdate.message || 'A new tally has been recorded.');
        }

        latestUpdateRef.current = latestStamp;
        setPayload(nextPayload);
        setError('');
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active && isInitial) {
          setLoading(false);
        }
      }
    }

    loadLeaderboard(true);
    const timer = setInterval(() => loadLeaderboard(false), 10000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedCategory, selectedEventId]);

  useEffect(() => {
    const availableEvents = payload?.events || [];

    if (availableEvents.length === 0) {
      if (selectedEventId) {
        setSelectedEventId('');
      }
      return;
    }

    const currentExists = availableEvents.some((item) => item.eventId === selectedEventId);
    if (!currentExists) {
      setSelectedEventId(payload?.selectedEventId || availableEvents[0].eventId || '');
    }
  }, [payload, selectedEventId]);

  useEffect(() => {
    if (!tickerMessage) return;
    const timer = setTimeout(() => setTickerMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [tickerMessage]);

  const leaderboard = payload?.leaderboard || [];
  const topThree = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

  if (loading) {
    return (
      <section className="panel community-shell">
        {!isAuthenticated && (
          <div className="community-topbar">
            <Link to="/" className="community-brand">
              RankIT
            </Link>
            <Link to="/login" className="community-login no-print">
              Staff Login
            </Link>
          </div>
        )}
        <p className="muted">Loading community leaderboard...</p>
      </section>
    );
  }

  if (payload?.noActiveEvent) {
    return (
      <section className="panel community-shell community-empty">
        {!isAuthenticated && (
          <div className="community-topbar">
            <Link to="/" className="community-brand">
              RankIT
            </Link>
            <Link to="/login" className="community-login no-print">
              Staff Login
            </Link>
          </div>
        )}
        <h1>RankIT Community View</h1>
        <p className="muted">Stay tuned for the next event.</p>
      </section>
    );
  }

  return (
    <section className="panel community-shell">
      {!isAuthenticated && (
        <div className="community-topbar">
          <Link to="/" className="community-brand">
            RankIT
          </Link>
          <Link to="/login" className="community-login no-print">
            Staff Login
          </Link>
        </div>
      )}

      <header className="community-header">
        <div className="community-headline">
          <p className="community-kicker">Public Community Leaderboard</p>
          <h1>{payload?.event?.eventName || 'Live Event'}</h1>
          <p className="muted">
            Category: <strong>{payload?.event?.category || 'N/A'}</strong>
          </p>
        </div>

        <span className={`badge community-status ${payload?.event?.badge === 'LIVE' ? 'warn' : 'ok'}`}>
          {payload?.event?.badge} - {payload?.event?.displayStatus}
        </span>

        <div className="community-filters">
          <label htmlFor="community-category">Filter by category</label>
          <select
            id="community-category"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedEventId('');
            }}
          >
            <option value="">All Categories</option>
            {(payload?.categories || []).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <label htmlFor="community-event">Event</label>
          <select
            id="community-event"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            {(payload?.events || []).map((item) => (
              <option key={item.eventId} value={item.eventId}>
                {item.eventName} ({item.displayStatus})
              </option>
            ))}
          </select>
        </div>
      </header>

      {tickerMessage && <div className="community-ticker">{tickerMessage}</div>}

      <section className="community-podium" aria-label="Top 3 podium">
        {[1, 0, 2].map((slot) => {
          const item = topThree[slot];
          const columnClass = slot === 0 ? 'podium-col first' : slot === 1 ? 'podium-col second' : 'podium-col third';
          const crownClass = slot === 0 ? 'podium-crown first' : slot === 1 ? 'podium-crown second' : 'podium-crown third';
          const fallbackLabel = `#${slot + 1}`;

          return (
            <article key={slot} className={columnClass}>
              <span className={crownClass} aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" focusable="false">
                  <path d="M3 18h18l-1.4-8.5-4.6 4.2L12 6 9 13.7 4.4 9.5 3 18z" />
                </svg>
              </span>
              <p className="podium-rank">{item ? `#${item.liveRank}` : fallbackLabel}</p>
              <h3>{item?.contestantName || 'TBD'}</h3>
              <p className="muted">Avg: {Number(item?.averageScore || 0).toFixed(2)}</p>
            </article>
          );
        })}
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Live Rank</th>
              <th>Contestant</th>
              <th>Average Score</th>
              <th>Total Score</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((row) => (
              <tr key={row.contestantId}>
                <td>{row.liveRank}</td>
                <td>
                  #{row.contestantNumber || '-'} {row.contestantName}
                </td>
                <td>{Number(row.averageScore || 0).toFixed(2)}</td>
                <td>{Number(row.totalScore || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payload?.event?.displayStatus === 'Completed' && (
        <section className="status-card community-winners">
          <h3>Finalized Winners</h3>
          <ol>
            {(payload?.winners || []).map((winner) => (
              <li key={winner.contestantId}>
                #{winner.liveRank} - #{winner.contestantNumber || '-'} {winner.contestantName}
              </li>
            ))}
          </ol>
        </section>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
