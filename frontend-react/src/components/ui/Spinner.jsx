export default function Spinner({ size = 'md', label = 'Loading' }) {
  return (
    <span className={`ui-spinner ui-spinner--${size}`} role={label ? 'status' : undefined}>
      <span className="ui-spinner__ring" aria-hidden="true" />
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}
