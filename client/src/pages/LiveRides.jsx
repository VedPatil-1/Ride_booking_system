import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getRides } from '../api/adminApi.js';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const timeFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const statuses = ['ALL', 'REQUESTED', 'ASSIGNED', 'NO_DRIVER_FOUND', 'ASSIGNMENT_FAILED'];

export default function LiveRides({ apiKey }) {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('ALL'); const [page, setPage] = useState(1); const [retry, setRetry] = useState(0); const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; setLoading(true); setError(''); const timer = setTimeout(() => getRides(apiKey, { search, status, page, limit: 25 }).then((result) => { if (active) setData(result); }).catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }), 220); return () => { active = false; clearTimeout(timer); }; }, [apiKey, search, status, page, retry]);
  return <div className="page-content"><div className="section-intro"><div><h2>All rides</h2><p>Search by ride, rider, route, or assigned driver.</p></div><span className="result-count">{data?.pagination.total ?? '—'} records</span></div>
    <section className="panel"><div className="filter-bar"><label className="search-box"><Search size={17} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search rides…" /></label><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>{statuses.map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All statuses' : value.replaceAll('_', ' ')}</option>)}</select></div>
      <DataTable rows={data?.rides} loading={loading} error={error} onRetry={() => setRetry((n) => n + 1)} emptyText="No rides match these filters." columns={[{ key: 'rideId', label: 'Ride ID', render: (r) => <span className="mono strong">{r.rideId}</span> }, { key: 'riderId', label: 'Rider ID', render: (r) => <span className="mono">{r.riderId}</span> }, { key: 'pickup', label: 'Pickup' }, { key: 'destination', label: 'Destination' }, { key: 'assignedDriver', label: 'Driver', render: (r) => r.assignedDriver ? <span className="mono">{r.assignedDriver}</span> : <span className="muted">Unassigned</span> }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'createdAt', label: 'Created', render: (r) => timeFmt.format(new Date(r.createdAt)) }]} />
      {data?.pagination.pages > 1 && <div className="pagination"><span>Page {page} of {data.pagination.pages}</span><div><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><button disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</button></div></div>}
    </section></div>;
}
