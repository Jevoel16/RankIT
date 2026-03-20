export default function ResultTable({ rankings }) {
  if (!rankings || rankings.length === 0) {
    return <p className="muted">No rankings yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Contestant</th>
            <th>Average Score</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((item, index) => (
            <tr key={item.contestantId || `${item.contestantName}-${index}`}>
              <td>{index + 1}</td>
              <td>{item.contestantName}</td>
              <td>{item.averageScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
