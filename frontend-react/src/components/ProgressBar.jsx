export default function ProgressBar({ current, total }) {
  const safeTotal = total > 0 ? total : 1;
  const percent = Math.min(100, Math.round((current / safeTotal) * 100));

  return (
    <div>
      <div className="progress-label">{current}/{total} Judges Submitted</div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
