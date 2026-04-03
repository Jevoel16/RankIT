export default function ScoreInputCard({
  criterion,
  value,
  onChange,
  idPrefix = '',
  enforceBounds = true,
  showMaxLabel = true
}) {
  const maxValue = Number(criterion.max ?? criterion.maxScore ?? criterion.weight ?? 100);
  const inputId = `${idPrefix ? `${idPrefix}-` : ''}criterion-${criterion.label}`;

  return (
    <div className="score-card">
      <div className="score-card-head">
        <span className="score-card-title">{criterion.label}</span>
        {showMaxLabel ? <span className="muted score-card-max">Max: {maxValue}</span> : null}
      </div>
      <input
        id={inputId}
        className="score-card-input"
        type="number"
        aria-label={criterion.label}
        min={enforceBounds ? 0 : undefined}
        max={enforceBounds ? maxValue : undefined}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
