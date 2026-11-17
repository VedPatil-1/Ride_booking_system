import { EmptyState, ErrorState, LoadingState } from './States.jsx';

export default function DataTable({ columns, rows, loading, error, onRetry, emptyText, rowKey }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!rows?.length) return <EmptyState message={emptyText} />;
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={rowKey ? rowKey(row) : row.rideId || row.eventId || row.driverId || index}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}
