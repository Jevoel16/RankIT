export default function EmptyState({ title, children, action, icon }) {
  return (
    <div className="ui-empty">
      {icon && (
        <div className="ui-empty__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="ui-empty__title">{title}</p>
      {children && <div className="ui-empty__body">{children}</div>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}
