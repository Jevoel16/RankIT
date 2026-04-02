export default function TablePager({ page, totalPages, canPrev, canNext, onPrev, onNext, totalItems }) {
  return (
    <div className="table-pager" role="navigation" aria-label="Table pagination">
      <button type="button" className="ghost-btn" onClick={onPrev} disabled={!canPrev}>
        Previous
      </button>
      <span className="muted">Page {page} of {totalPages} ({totalItems} rows)</span>
      <button type="button" className="ghost-btn" onClick={onNext} disabled={!canNext}>
        Next
      </button>
    </div>
  );
}
