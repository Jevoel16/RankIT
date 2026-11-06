export default function Pager({ page, totalPages, canPrev, canNext, onPrev, onNext, totalItems }) {
  return (
    <nav className="ui-pager" aria-label="Pagination">
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onPrev} disabled={!canPrev}>
        Previous
      </button>
      <span className="ui-pager__status" aria-live="polite">
        Page {page} of {totalPages}
        {totalItems != null && <span className="muted"> · {totalItems} rows</span>}
      </span>
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onNext} disabled={!canNext}>
        Next
      </button>
    </nav>
  );
}
