import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Podium, RankingList, StatusBadge } from '../components/rankings/Rankings';
import { EmptyState, Skeleton, TabPanel, Tabs } from '../components/ui';
import usePersistentState from '../hooks/usePersistentState';
import { useCategoryRankings, useEventLeaderboard, useOverallRankings } from '../hooks/usePublicRankings';
import { isLiveBadge, normalizeCategoryRows, normalizeEventRows, normalizeOverallRows } from '../utils/rankings';

const TABS_ID = 'community-views';

function Leaderboard({ rows, loading, emptyTitle }) {
  if (loading && rows.length === 0) return <Skeleton lines={6} height={22} />;
  if (rows.length === 0)
    return <EmptyState title={emptyTitle}>Scores appear here as soon as they are recorded.</EmptyState>;
  return (
    <div className="leaderboard" aria-live="polite">
      <Podium rows={rows.slice(0, 3)} />
      {rows.length > 3 && <RankingList rows={rows} start={3} label="Remaining rankings" />}
    </div>
  );
}

export default function CommunityHome() {
  const location = useLocation();
  const notice = new URLSearchParams(location.search).get('notice') || '';
  const [prefs, setPrefs] = usePersistentState('rankit_ui_community', { view: 'event', eventId: '', category: '' });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const eventState = useEventLeaderboard({ eventId: prefs.eventId });
  const payload = eventState.data;
  const access = payload?.rankingAccess || {};
  const categories = useMemo(() => payload?.categories || [], [payload]);
  const categoryName = prefs.category && categories.includes(prefs.category) ? prefs.category : categories[0] || '';
  const categoryState = useCategoryRankings(
    categoryName,
    Boolean(access.categoryRankingsEnabled) && prefs.view === 'category'
  );
  const overallState = useOverallRankings(Boolean(access.overallRankingsEnabled) && prefs.view === 'overall');

  const tabs = [
    { id: 'event', label: 'By event' },
    access.categoryRankingsEnabled && { id: 'category', label: 'By category' },
    access.overallRankingsEnabled && { id: 'overall', label: 'Overall' }
  ].filter(Boolean);
  const view = tabs.some((tab) => tab.id === prefs.view) ? prefs.view : 'event';
  const update = (patch) => setPrefs((prev) => ({ ...prev, ...patch }));

  // If the remembered event disappeared (hidden by an admin), fall back to the server's pick.
  useEffect(() => {
    if (payload && prefs.eventId && !(payload.events || []).some((item) => String(item.eventId) === prefs.eventId)) {
      update({ eventId: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  const events = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (payload?.events || []).filter(
      (item) =>
        (!categoryFilter || item.category === categoryFilter) &&
        (!keyword || String(item.eventName).toLowerCase().includes(keyword))
    );
  }, [payload, search, categoryFilter]);

  const selectedEventId = String(payload?.selectedEventId || '');
  const eventRows = useMemo(() => normalizeEventRows(payload?.leaderboard), [payload]);
  const categoryRows = useMemo(() => normalizeCategoryRows(categoryState.data?.rankings), [categoryState.data]);
  const overallRows = useMemo(() => normalizeOverallRows(overallState.data?.rankings), [overallState.data]);

  if (eventState.loading && !payload) {
    return (
      <section className="community" aria-busy="true">
        <Skeleton lines={2} height={36} />
        <Skeleton lines={8} height={22} />
      </section>
    );
  }

  if (payload?.noActiveEvent || (!payload && eventState.error)) {
    return (
      <section className="community community--empty">
        <h1>Live Rankings</h1>
        <EmptyState title={eventState.error ? 'Rankings are unavailable right now' : 'Stay tuned for the next event'}>
          {eventState.error ? 'Please try again in a moment.' : 'Results will appear here once an event starts.'}
        </EmptyState>
      </section>
    );
  }

  const displayHref = view === 'event' && selectedEventId ? `/display/${selectedEventId}` : '/display';

  return (
    <section className="community">
      <header className="community__hero">
        <div>
          <p className="eyebrow">Live rankings</p>
          <h1>
            {view === 'event' ? payload?.event?.eventName : view === 'category' ? categoryName : 'Overall standings'}
          </h1>
          <p className="muted">
            {view === 'event' && payload?.event && (
              <>
                {payload.event.category} ·{' '}
                <StatusBadge live={isLiveBadge(payload.event.badge)}>{payload.event.displayStatus}</StatusBadge>
              </>
            )}
            {view !== 'event' && 'Weighted points from every event placement.'}
          </p>
        </div>
        <Link className="ui-btn ui-btn--secondary" to={displayHref}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="currentColor">
            <path d="M3 5h18v11H3V5Zm2 2v7h14V7H5Zm3 11h8v2H8v-2Z" />
          </svg>
          Display mode
        </Link>
      </header>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {payload?.latestUpdate?.message && view === 'event' && (
        <p className="ticker" role="status">
          {payload.latestUpdate.message}
        </p>
      )}

      {tabs.length > 1 && (
        <Tabs baseId={TABS_ID} label="Ranking view" tabs={tabs} value={view} onChange={(id) => update({ view: id })} />
      )}

      <TabPanel baseId={TABS_ID} id={view} active className="community__panel">
        {view === 'event' && (
          <div className="community__event-layout">
            <aside className="event-picker" aria-label="Events">
              <input
                type="search"
                className="event-picker__search"
                placeholder="Search events"
                aria-label="Search events"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="chip-row" role="group" aria-label="Filter by category">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={!categoryFilter}
                  onClick={() => setCategoryFilter('')}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="chip"
                    aria-pressed={categoryFilter === category}
                    onClick={() => setCategoryFilter(category)}
                  >
                    {category.replace(' Events Category', '')}
                  </button>
                ))}
              </div>
              <ul className="event-picker__list">
                {events.map((item) => {
                  const id = String(item.eventId);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={`event-card ${id === selectedEventId ? 'is-active' : ''}`}
                        aria-current={id === selectedEventId ? 'true' : undefined}
                        onClick={() => update({ eventId: id })}
                      >
                        <span className="event-card__name">{item.eventName}</span>
                        <span className="event-card__meta">
                          <span>{String(item.category).replace(' Events Category', '')}</span>
                          <StatusBadge live={isLiveBadge(item.badge)}>{item.displayStatus}</StatusBadge>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {events.length === 0 && <li className="muted event-picker__none">No events match.</li>}
              </ul>
            </aside>
            <Leaderboard rows={eventRows} loading={eventState.loading} emptyTitle="No scores yet" />
          </div>
        )}

        {view === 'category' && (
          <div className="form-stack">
            <div className="chip-row" role="group" aria-label="Category">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className="chip"
                  aria-pressed={categoryName === category}
                  onClick={() => update({ category })}
                >
                  {category.replace(' Events Category', '')}
                </button>
              ))}
            </div>
            <Leaderboard rows={categoryRows} loading={categoryState.loading} emptyTitle="No category points yet" />
          </div>
        )}

        {view === 'overall' && (
          <Leaderboard rows={overallRows} loading={overallState.loading} emptyTitle="No overall points yet" />
        )}
      </TabPanel>

      <p className="community__footnote muted">
        Updates automatically every few seconds. Placement points: 1st 10 · 2nd 7 · 3rd 5 · 4th 3 · 5th 2 · 6th 1.
      </p>
    </section>
  );
}
