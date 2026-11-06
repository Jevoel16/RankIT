import usePagination from '../../hooks/usePagination';
import Pager from './Pager';
import EmptyState from './EmptyState';

const cellClass = (column) =>
  [column.align ? `align-${column.align}` : '', column.hideOnMobile ? 'hide-mobile' : ''].filter(Boolean).join(' ') ||
  undefined;

// Table that collapses into labelled cards on phones (see .ui-table in ui.css).
// columns: [{ key, header, render?(row), align?, hideOnMobile? }]
export default function DataTable({
  columns,
  rows = [],
  rowKey = (row) => row._id || row.id,
  pageSize = 10,
  caption,
  emptyTitle = 'Nothing to show yet',
  emptyMessage,
  className = ''
}) {
  const pager = usePagination(rows, pageSize);

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle}>{emptyMessage}</EmptyState>;
  }

  return (
    <div className={`ui-table-wrap ${className}`.trim()}>
      <table className="ui-table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cellClass(column)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pager.paginatedItems.map((row, index) => (
            <tr key={rowKey(row) ?? index}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={typeof column.header === 'string' ? column.header : undefined}
                  className={cellClass(column)}
                >
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pager.totalPages > 1 && (
        <Pager
          page={pager.page}
          totalPages={pager.totalPages}
          totalItems={pager.totalItems}
          canPrev={pager.canPrev}
          canNext={pager.canNext}
          onPrev={pager.goPrev}
          onNext={pager.goNext}
        />
      )}
    </div>
  );
}
