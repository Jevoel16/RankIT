export default function Skeleton({ lines = 3, height = 14 }) {
  return (
    <div className="ui-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="ui-skeleton__line" style={{ height, width: `${100 - (index % 3) * 18}%` }} />
      ))}
    </div>
  );
}
