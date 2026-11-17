const styles = {
  REQUESTED: 'badge amber', ASSIGNED: 'badge green', NO_DRIVER_FOUND: 'badge rose',
  ASSIGNMENT_FAILED: 'badge rose', PROCESSED: 'badge green', UNPROCESSED: 'badge amber',
  AVAILABLE: 'badge blue', NO_ASSIGNED_RIDE_RECORD: 'badge neutral', HAS_ASSIGNED_RIDE_RECORD: 'badge amber', healthy: 'badge green', unavailable: 'badge rose',
};

export default function StatusBadge({ status }) {
  return <span className={styles[status] || 'badge neutral'}><i />{String(status || 'unknown').replaceAll('_', ' ')}</span>;
}
