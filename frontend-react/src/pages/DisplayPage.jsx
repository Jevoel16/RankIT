import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Podium, RankingList, StatusBadge } from '../components/rankings/Rankings';
import { useCategoryRankings, useEventLeaderboard, useOverallRankings } from '../hooks/usePublicRankings';
import { isLiveBadge, normalizeCategoryRows, normalizeEventRows, normalizeOverallRows } from '../utils/rankings';

const DEFAULT_SECONDS = 15;

function useQrCode(url) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#0b1017', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [url]);
  return src;
}

// Full-screen projector view: rotates event -> category -> overall standings.
// URL options: /display/:eventId?rotate=0 (pin the event) &seconds=20
export default function DisplayPage() {
  const { eventId = '' } = useParams();
  const [params] = useSearchParams();
  const seconds = Math.max(5, Number(params.get('seconds')) || DEFAULT_SECONDS);
  const rotate = params.get('rotate') !== '0';

  const eventState = useEventLeaderboard({ eventId }, 8000);
  const payload = eventState.data;
  const access = payload?.rankingAccess || {};
  const category = payload?.event?.category || '';
  const categoryState = useCategoryRankings(category, Boolean(access.categoryRankingsEnabled));
  const overallState = useOverallRankings(Boolean(access.overallRankingsEnabled));

  const views = useMemo(
    () =>
      [
        {
          id: 'event',
          title: payload?.event?.eventName,
          subtitle: category,
          rows: normalizeEventRows(payload?.leaderboard)
        },
        access.categoryRankingsEnabled && {
          id: 'category',
          title: category,
          subtitle: 'Category standings',
          rows: normalizeCategoryRows(categoryState.data?.rankings)
        },
        access.overallRankingsEnabled && {
          id: 'overall',
          title: 'Overall standings',
          subtitle: 'All categories',
          rows: normalizeOverallRows(overallState.data?.rankings)
        }
      ].filter((view) => view && view.title && view.rows.length > 0),
    [
      payload,
      category,
      access.categoryRankingsEnabled,
      access.overallRankingsEnabled,
      categoryState.data,
      overallState.data
    ]
  );

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = views[index % Math.max(views.length, 1)];

  useEffect(() => {
    if (!rotate || paused || views.length < 2) return undefined;
    const timer = setTimeout(() => setIndex((value) => (value + 1) % views.length), seconds * 1000);
    return () => clearTimeout(timer);
  }, [index, rotate, paused, views.length, seconds]);

  const publicUrl = `${window.location.origin}/`;
  const qr = useQrCode(publicUrl);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'f' || event.key === 'F') toggleFullscreen();
      if (event.key === ' ') {
        event.preventDefault();
        setPaused((value) => !value);
      }
      if (event.key === 'ArrowRight') setIndex((value) => value + 1);
      if (event.key === 'ArrowLeft') setIndex((value) => (value - 1 + views.length) % Math.max(views.length, 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [views.length]);

  return (
    <main className="display" aria-live="polite">
      <header className="display__top">
        <span className="display__brand">
          <img src="/logo.svg" alt="" width="40" height="40" />
          RankIT
        </span>
        {payload?.event && (
          <StatusBadge live={isLiveBadge(payload.event.badge)}>{payload.event.displayStatus}</StatusBadge>
        )}
        <span className="display__controls">
          <button
            type="button"
            className="display__btn"
            onClick={() => setPaused((value) => !value)}
            aria-pressed={paused}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="display__btn" onClick={toggleFullscreen}>
            Full screen
          </button>
          <Link className="display__btn" to="/">
            Exit
          </Link>
        </span>
      </header>

      {!active ? (
        <section className="display__empty">
          <h1>{payload?.noActiveEvent ? 'Stay tuned for the next event' : 'Waiting for scores…'}</h1>
        </section>
      ) : (
        <section key={active.id} className="display__stage">
          <div className="display__heading">
            <p className="display__eyebrow">{active.subtitle}</p>
            <h1 className="display__title">{active.title}</h1>
          </div>
          <div className="display__content">
            <Podium rows={active.rows.slice(0, 3)} size="xl" />
            {active.rows.length > 3 && (
              <RankingList rows={active.rows} start={3} limit={7} size="xl" label="Places 4 to 10" />
            )}
          </div>
        </section>
      )}

      <footer className="display__bottom">
        {views.length > 1 && (
          <ol className="display__dots" aria-label="Views">
            {views.map((view) => (
              <li key={view.id} className={view.id === active?.id ? 'is-active' : ''}>
                <span className="visually-hidden">{view.title}</span>
              </li>
            ))}
          </ol>
        )}
        {rotate && !paused && views.length > 1 && (
          <span
            key={`${active?.id}-${index}`}
            className="display__progress"
            style={{ animationDuration: `${seconds}s` }}
            aria-hidden="true"
          />
        )}
        {qr && (
          <figure className="display__qr">
            <img src={qr} alt={`QR code for ${publicUrl}`} width="120" height="120" />
            <figcaption>Follow live on your phone</figcaption>
          </figure>
        )}
      </footer>
    </main>
  );
}
