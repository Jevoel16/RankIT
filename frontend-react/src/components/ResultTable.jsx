import usePagination from '../hooks/usePagination';
import TablePager from './TablePager';

export default function ResultTable({ rankings }) {
  const safeRankings = rankings ?? [];
  const rankingsPagination = usePagination(safeRankings, 10);

  if (safeRankings.length === 0) {
    return <p className="muted">No rankings yet.</p>;
  }

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Contestant</th>
              <th>Raw Avg</th>
              <th>Deductions</th>
              <th>Final Score</th>
            </tr>
          </thead>
          <tbody>
            {rankingsPagination.paginatedItems.map((item, index) => (
              <tr key={item.contestantId || `${item.contestantName}-${index}`}>
                <td>{(rankingsPagination.page - 1) * rankingsPagination.pageSize + index + 1}</td>
                <td>{item.contestantName}</td>
                <td>{item.rawAverageScore ?? item.averageScore}</td>
                <td>{item.deductionPoints ?? 0}</td>
                <td>{item.finalScore ?? item.averageScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager
        page={rankingsPagination.page}
        totalPages={rankingsPagination.totalPages}
        totalItems={rankingsPagination.totalItems}
        canPrev={rankingsPagination.canPrev}
        canNext={rankingsPagination.canNext}
        onPrev={rankingsPagination.goPrev}
        onNext={rankingsPagination.goNext}
      />
    </>
  );
}
