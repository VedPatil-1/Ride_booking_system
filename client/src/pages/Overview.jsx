import { useEffect, useState } from 'react';
import { Activity, CarFront, CircleAlert, CircleCheck, Clock3 } from 'lucide-react';
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getOverview } from '../api/adminApi.js';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { ErrorState, LoadingState } from '../components/States.jsx';

const COLORS = ['#eab55e', '#55b58b', '#e17c83', '#9b8ce4'];
const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Overview({ apiKey }) {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); setError(''); try { setData(await getOverview(apiKey)); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [apiKey]);
  if (loading && !data) return <LoadingState label="Loading overview…" />;
  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  const totals = data.totals;
  const cards = [
    { label: 'Total rides', value: totals.total, icon: CarFront, tone: 'tone-navy', caption: 'All recorded rides' },
    { label: 'Requested', value: totals.requested, icon: Clock3, tone: 'tone-amber', caption: 'Awaiting assignment' },
    { label: 'Assigned', value: totals.assigned, icon: CircleCheck, tone: 'tone-green', caption: 'Driver assigned' },
    { label: 'No driver found', value: totals.noDriverFound, icon: CircleAlert, tone: 'tone-rose', caption: 'Three rejections' },
    { label: 'Assignment failures', value: totals.assignmentFailed, icon: Activity, tone: 'tone-violet', caption: 'Infrastructure failures' },
  ];
  return <div className="page-content">
    {error && <div className="inline-warning">{error} Showing last loaded data.</div>}
    <div className="section-intro"><div><h2>Operations overview</h2><p>Real ride records from the connected backend.</p></div><span className="updated-label">Updated {new Date(data.dataAsOf).toLocaleTimeString()}</span></div>
    <div className="stats-grid">{cards.map(({ label, value, icon: Icon, tone, caption }) => <article className="stat-card" key={label}><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}><Icon size={18} /></div></div><strong>{value.toLocaleString()}</strong><small>{caption}</small></article>)}</div>
    <div className="charts-grid">
      <section className="panel"><div className="panel-heading"><div><h3>Ride activity</h3><p>Rides created over the last 7 days</p></div><span className="chart-legend"><i /> Rides</span></div><div className="chart-body">{data.rideActivity.every((item) => item.count === 0) ? <div className="chart-empty">No ride activity in this period.</div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={data.rideActivity} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}><CartesianGrid stroke="#edf0f4" vertical={false} /><XAxis dataKey="date" tickFormatter={(v) => new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })} tickLine={false} axisLine={false} tick={{ fill: '#8791a2', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8791a2', fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="count" name="Rides" stroke="#365cf5" strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer>}</div></section>
      <section className="panel"><div className="panel-heading"><div><h3>Status distribution</h3><p>Current ride lifecycle</p></div></div><div className="distribution-layout"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.statusDistribution.filter((item) => item.count > 0)} dataKey="count" nameKey="status" innerRadius={57} outerRadius={82} paddingAngle={4} stroke="none">{data.statusDistribution.filter((item) => item.count > 0).map((item) => <Cell key={item.status} fill={COLORS[data.statusDistribution.indexOf(item)]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><b>{totals.total}</b><small>rides</small></div></div><div className="distribution-legend">{data.statusDistribution.map((item, i) => <div key={item.status}><i style={{ background: COLORS[i] }} /><span>{item.status.replaceAll('_', ' ').toLowerCase()}</span><b>{item.count}</b></div>)}</div></div></section>
    </div>
    <section className="panel recent-panel"><div className="panel-heading"><div><h3>Recent rides</h3><p>Latest ride records received by the backend</p></div></div><DataTable rows={data.recentRides} loading={false} columns={[{ key: 'rideId', label: 'Ride ID', render: (r) => <span className="mono strong">{r.rideId}</span> }, { key: 'riderId', label: 'Rider' }, { key: 'route', label: 'Route', render: (r) => <span>{r.pickup} <span className="muted">→</span> {r.destination}</span> }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'createdAt', label: 'Created', render: (r) => dateFormat.format(new Date(r.createdAt)) }]} />
    </section>
    <p className="data-footnote">Statistics use actual MongoDB ride records. Driver availability is derived from assigned ride records.</p>
  </div>;
}
