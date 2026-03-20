export default function ScoreInputCard({ criterion, value, onChange }) {
  const maxValue = Number(criterion.max ?? criterion.maxScore ?? criterion.weight ?? 100);

  return (
    <div className="score-card">
      <label htmlFor={`criterion-${criterion.label}`}>
        {criterion.label}
        <span className="muted">Max: {maxValue}</span>
      </label>
      <input
        id={`criterion-${criterion.label}`}
        type="number"
        min={0}
        max={maxValue}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
