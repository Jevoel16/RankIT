import { useRankMovement } from '../../hooks/usePublicRankings';

const CROWN = 'M3 18h18l-1.4-8.5-4.6 4.2L12 6 9 13.7 4.4 9.5 3 18z';
const MEDALS = ['gold', 'silver', 'bronze'];

// Top three in podium order (2nd, 1st, 3rd) with medal colors.
export function Podium({ rows, size = 'md' }) {
  const slots = [1, 0, 2];
  return (
    <ol className={`podium podium--${size}`} aria-label="Top three">
      {slots.map((slot) => {
        const row = rows[slot];
        const medal = MEDALS[slot];
        return (
          <li key={slot} className={`podium__place podium__place--${medal} ${row ? '' : 'is-empty'}`}>
            <svg className="podium__crown" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d={CROWN} />
            </svg>
            <span className="podium__rank">#{row?.rank || slot + 1}</span>
            <span className="podium__name">{row?.name || 'TBD'}</span>
            {row && (
              <span className="podium__value">
                {row.value} {row.valueLabel}
              </span>
            )}
            <span className="podium__step" aria-hidden="true" />
          </li>
        );
      })}
    </ol>
  );
}

// Ranked list with movement arrows between updates.
export function RankingList({ rows, start = 0, limit = rows.length, size = 'md', label = 'Rankings' }) {
  const movement = useRankMovement(rows);
  const visible = rows.slice(start, start + limit);

  return (
    <ol className={`rank-list rank-list--${size}`} aria-label={label}>
      {visible.map((row) => {
        const move = movement.get(row.key);
        return (
          <li key={row.key} className={`rank-list__row ${move ? `is-moved-${move}` : ''}`}>
            <span className={`rank-list__rank ${row.rank <= 3 ? `rank-list__rank--${MEDALS[row.rank - 1]}` : ''}`}>
              {row.rank}
            </span>
            <span className="rank-list__name">{row.name}</span>
            {move && (
              <span className={`rank-list__move rank-list__move--${move}`}>
                <span aria-hidden="true">{move === 'up' ? '▲' : '▼'}</span>
                <span className="visually-hidden">moved {move}</span>
              </span>
            )}
            <span className="rank-list__value">
              {row.value}
              <small> {row.valueLabel}</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusBadge({ live, children }) {
  return (
    <span className={`status-pill ${live ? 'status-pill--live' : 'status-pill--ended'}`}>
      {live && <span className="status-pill__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
