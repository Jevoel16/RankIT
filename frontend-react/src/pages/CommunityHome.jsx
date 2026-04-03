import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchPublicCategoryRankings, fetchPublicLeaderboard, fetchPublicOverallLeaderboard } from '../api';
import { useAuth } from '../hooks/useAuth';
import usePagination from '../hooks/usePagination';
import TablePager from '../components/TablePager';

const TAB_EVENT = 'event';
const TAB_CATEGORY = 'category';
const TAB_OVERALL = 'overall';

// Rank to points mapping (10, 7, 5, 3, 2, 1, 0)
const RANK_TO_POINTS = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
  5: 2,
  6: 1
};

const getRankPoints = (rank) => {
  if (rank >= 1 && rank <= 6) {
    return RANK_TO_POINTS[rank];
  }
  return 0; // 7+ get 0 points
};

export default function CommunityHome() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const notice = useMemo(() => new URLSearchParams(location.search).get('notice') || '', [location.search]);

  const [activeTab, setActiveTab] = useState(TAB_EVENT);
  const [eventPayload, setEventPayload] = useState(null);
  const [categoryPayload, setCategoryPayload] = useState(null);
  const [overallPayload, setOverallPayload] = useState(null);
  const [selectedEventCategory, setSelectedEventCategory] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  const [error, setError] = useState('');
  const [eventLoading, setEventLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [overallLoading, setOverallLoading] = useState(true);
  const [tickerMessage, setTickerMessage] = useState('');

  const latestUpdateRef = useRef('');

  useEffect(() => {
    let active = true;

    async function loadEventLeaderboard() {
      setEventLoading(true);

      try {
        const nextPayload = await fetchPublicLeaderboard(selectedEventCategory, selectedEventId);
        if (!active) return;

        const latestStamp = nextPayload?.latestUpdate?.submittedAt || '';
        if (latestStamp && latestUpdateRef.current && latestStamp !== latestUpdateRef.current) {
          setTickerMessage(nextPayload.latestUpdate.message || 'A new score sheet has been recorded.');
        }

        latestUpdateRef.current = latestStamp;
        setEventPayload(nextPayload);
        setError('');

        if (!selectedCategoryName && Array.isArray(nextPayload?.categories) && nextPayload.categories.length > 0) {
          setSelectedCategoryName(nextPayload.categories[0]);
        }

        const availableEvents = nextPayload?.events || [];
        if (availableEvents.length === 0) {
          if (selectedEventId) {
            setSelectedEventId('');
          }
          return;
        }

        const currentExists = availableEvents.some((item) => item.eventId === selectedEventId);
        if (!currentExists) {
          setSelectedEventId(nextPayload?.selectedEventId || availableEvents[0].eventId || '');
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setEventLoading(false);
        }
      }
    }

    loadEventLeaderboard();
    const timer = setInterval(loadEventLeaderboard, 10000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedEventCategory, selectedEventId, selectedCategoryName]);

  useEffect(() => {
    let active = true;

    async function loadCategoryRankings() {
      if (!selectedCategoryName) {
        setCategoryPayload(null);
        setCategoryLoading(false);
        return;
      }

      setCategoryLoading(true);

      try {
        const nextPayload = await fetchPublicCategoryRankings(selectedCategoryName);
        if (!active) return;
        setCategoryPayload(nextPayload);
        setError('');
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setCategoryLoading(false);
        }
      }
    }

    loadCategoryRankings();
    const timer = setInterval(loadCategoryRankings, 10000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedCategoryName]);

  useEffect(() => {
    let active = true;

    async function loadOverallRankings() {
      setOverallLoading(true);

      try {
        const nextPayload = await fetchPublicOverallLeaderboard();
        if (!active) return;
        setOverallPayload(nextPayload);
        setError('');
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setOverallLoading(false);
        }
      }
    }

    loadOverallRankings();
    const timer = setInterval(loadOverallRankings, 10000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!tickerMessage) return;
    const timer = setTimeout(() => setTickerMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [tickerMessage]);

  const eventLeaderboard = eventPayload?.leaderboard || [];
  const categoryLeaderboard = categoryPayload?.rankings || [];
  const overallLeaderboard = overallPayload?.rankings || [];

  const eventPagination = usePagination(eventLeaderboard, 10);
  const categoryPagination = usePagination(categoryLeaderboard, 10);
  const overallPagination = usePagination(overallLeaderboard, 10);

  const eventTopThree = useMemo(() => eventLeaderboard.slice(0, 3), [eventLeaderboard]);
  const categoryTopThree = useMemo(() => categoryLeaderboard.slice(0, 3), [categoryLeaderboard]);
  const overallTopThree = useMemo(() => overallLeaderboard.slice(0, 3), [overallLeaderboard]);

  const availableCategories = eventPayload?.categories || [];
  const rankingAccess = eventPayload?.rankingAccess || {
    categoryRankingsEnabled: true,
    overallRankingsEnabled: true
  };

  const categoryAccessEnabled = Boolean(rankingAccess.categoryRankingsEnabled);
  const overallAccessEnabled = Boolean(rankingAccess.overallRankingsEnabled);

  const publicTopbar = !isAuthenticated ? (
    <div className="community-topbar">
      <Link to="/" className="community-brand">
        RankIT
      </Link>
      <Link to="/login" className="community-login no-print">
        Staff Login
      </Link>
    </div>
  ) : null;

  useEffect(() => {
    if (activeTab === TAB_CATEGORY && !categoryAccessEnabled) {
      setActiveTab(TAB_EVENT);
      return;
    }

    if (activeTab === TAB_OVERALL && !overallAccessEnabled) {
      setActiveTab(TAB_EVENT);
    }
  }, [activeTab, categoryAccessEnabled, overallAccessEnabled]);

  const renderLoadingShell = (message) => (
    <>
      {publicTopbar}
      <section className="panel community-shell">
        <p className="muted">{message}</p>
      </section>
    </>
  );

  if (eventLoading && !eventPayload) {
    return renderLoadingShell('Loading community leaderboard...');
  }

  if (eventPayload?.noActiveEvent) {
    return (
      <>
        {publicTopbar}
        <section className="panel community-shell community-empty">
          <h1>RankIT Community View</h1>
          <p className="muted">Stay tuned for the next event.</p>
        </section>
      </>
    );
  }

  return (
    <>
      {publicTopbar}
      <section className="panel community-shell">
        <header className="community-header">
        <div className="community-headline">
          <p className="community-kicker">Public Community Leaderboard</p>
          <h1>Rankings Dashboard</h1>
          <p className="muted">Switch views and apply filters from one control bubble.</p>
        </div>

        <div className="community-control-bubble">
          <div className="community-tabs" role="tablist" aria-label="Community ranking views">
            <button type="button" className={`subtab-btn ${activeTab === TAB_EVENT ? 'active' : ''}`} onClick={() => setActiveTab(TAB_EVENT)}>
              Event
            </button>
            <button
              type="button"
              className={`subtab-btn ${activeTab === TAB_CATEGORY ? 'active' : ''}`}
              onClick={() => setActiveTab(TAB_CATEGORY)}
              disabled={!categoryAccessEnabled}
              title={categoryAccessEnabled ? 'View category rankings' : 'Category rankings are locked by admin'}
            >
              Category
            </button>
            <button
              type="button"
              className={`subtab-btn ${activeTab === TAB_OVERALL ? 'active' : ''}`}
              onClick={() => setActiveTab(TAB_OVERALL)}
              disabled={!overallAccessEnabled}
              title={overallAccessEnabled ? 'View overall rankings' : 'Overall rankings are locked by admin'}
            >
              Overall
            </button>
          </div>

          <div className="community-filters">
            {activeTab === TAB_EVENT && (
              <>
                <label htmlFor="community-category">Filter by category</label>
                <select
                  id="community-category"
                  value={selectedEventCategory}
                  onChange={(e) => {
                    setSelectedEventCategory(e.target.value);
                    setSelectedEventId('');
                  }}
                >
                  <option value="">All Categories</option>
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <label htmlFor="community-event">Event</label>
                <select id="community-event" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                  {(eventPayload?.events || []).map((item) => (
                    <option key={item.eventId} value={item.eventId}>
                      {item.eventName} ({item.displayStatus})
                    </option>
                  ))}
                </select>
              </>
            )}

            {activeTab === TAB_CATEGORY && (
              <>
                <label htmlFor="community-category-ranking">Category</label>
                <select
                  id="community-category-ranking"
                  value={selectedCategoryName}
                  onChange={(e) => setSelectedCategoryName(e.target.value)}
                >
                  <option value="">Select category</option>
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {activeTab === TAB_EVENT && eventPayload?.event?.displayStatus && (
          <div className="community-main-status">
            <span className={`badge community-status ${(eventPayload?.event?.badge === 'IN-PROGRESS' || eventPayload?.event?.badge === 'LIVE') ? 'warn' : 'ok'}`}>
              {eventPayload.event.displayStatus}
            </span>
          </div>
        )}
        </header>

        {notice && <div className="community-ticker">{notice}</div>}
        {tickerMessage && <div className="community-ticker">{tickerMessage}</div>}

        {activeTab === TAB_EVENT && (
          <>
          <section className="community-podium" aria-label="Top 3 podium">
            {[1, 0, 2].map((slot) => {
              const item = eventTopThree[slot];
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
                </article>
              );
            })}
          </section>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Contestant</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {eventPagination.paginatedItems.map((row) => (
                  <tr key={row.contestantId}>
                    <td>#{row.liveRank}</td>
                    <td>{row.contestantName}</td>
                    <td>{getRankPoints(row.liveRank)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager
            page={eventPagination.page}
            totalPages={eventPagination.totalPages}
            totalItems={eventPagination.totalItems}
            canPrev={eventPagination.canPrev}
            canNext={eventPagination.canNext}
            onPrev={eventPagination.goPrev}
            onNext={eventPagination.goNext}
          />

          </>
        )}

        {activeTab === TAB_CATEGORY && (
          <>
          {!categoryAccessEnabled ? (
            <p className="muted">Category rankings are currently locked by the admin.</p>
          ) : categoryLoading && !categoryPayload ? (
            <p className="muted">Loading category rankings...</p>
          ) : (
            <>
              <section className="community-podium" aria-label="Top 3 category podium">
                {[1, 0, 2].map((slot) => {
                  const item = categoryTopThree[slot];
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
                      <p className="podium-rank">{item ? `#${item.rank}` : fallbackLabel}</p>
                      <h3>{item?.contestantName || 'TBD'}</h3>
                    </article>
                  );
                })}
              </section>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Contestant</th>
                      <th>Total Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryPagination.paginatedItems.map((row) => (
                      <tr key={row.contestantName}>
                        <td>#{row.rank}</td>
                        <td>{row.contestantName}</td>
                        <td>{Number(row.categoryTotalPoints || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager
                page={categoryPagination.page}
                totalPages={categoryPagination.totalPages}
                totalItems={categoryPagination.totalItems}
                canPrev={categoryPagination.canPrev}
                canNext={categoryPagination.canNext}
                onPrev={categoryPagination.goPrev}
                onNext={categoryPagination.goNext}
              />
            </>
          )}
          </>
        )}

        {activeTab === TAB_OVERALL && (
          <>
          {!overallAccessEnabled ? (
            <p className="muted">Overall rankings are currently locked by the admin.</p>
          ) : overallLoading && !overallPayload ? (
            <p className="muted">Loading overall rankings...</p>
          ) : (
            <>
              <section className="community-podium" aria-label="Top 3 overall podium">
                {[1, 0, 2].map((slot) => {
                  const item = overallTopThree[slot];
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
                      <p className="podium-rank">{item ? `#${item.rank}` : fallbackLabel}</p>
                      <h3>{item?.contestantName || 'TBD'}</h3>
                    </article>
                  );
                })}
              </section>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Contestant</th>
                      <th>Total Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overallPagination.paginatedItems.map((row) => (
                      <tr key={row.contestantName}>
                        <td>#{row.rank}</td>
                        <td>{row.contestantName}</td>
                        <td>{Number(row.weightedTotal || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager
                page={overallPagination.page}
                totalPages={overallPagination.totalPages}
                totalItems={overallPagination.totalItems}
                canPrev={overallPagination.canPrev}
                canNext={overallPagination.canNext}
                onPrev={overallPagination.goPrev}
                onNext={overallPagination.goNext}
              />
            </>
          )}
          </>
        )}

        {error && <p className="error">{error}</p>}
      </section>
    </>
  );
}