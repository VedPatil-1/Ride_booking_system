import { useEffect, useState } from 'react';
import { Radio, CircleCheck, Clock3 } from 'lucide-react';
import { getEvents } from '../api/adminApi.js';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Events({ apiKey }) {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; getEvents(apiKey).then((d) => active && setData(d)).catch((e) => active && setError(e.message)).finally(() => active && setLoading(false)); return () => { active = false; }; }, [apiKey]);
  const events = data?.events || [];
  return <div className="page-content"><div className="section-intro"><div><h2>Stream events</h2><p>Recent events read from the backend Redis Stream.</p></div><span className="result-count">{events.length} recent events</span></div>
    <div className="callout"><Radio size={18} /><span>Processing labels come from each consumer’s processed-event set. An event can be processed by one service and unprocessed by the other.</span></div>
    <div className="event-summary"><article className="panel"><div className="event-metric"><Radio /><span>Events displayed</span></div><b>{loading ? '—' : events.length}</b></article><article className="panel"><div className="event-metric"><CircleCheck /><span>Billing processed</span></div><b>{loading ? '—' : events.filter((e) => e.billing === 'PROCESSED').length}</b></article><article className="panel"><div className="event-metric"><Clock3 /><span>Awaiting processing</span></div><b>{loading ? '—' : events.filter((e) => e.billing === 'UNPROCESSED' || e.operations === 'UNPROCESSED').length}</b></article></div>
    <section className="panel"><div className="panel-heading"><div><h3>Recent event records</h3><p>Newest stream records first · capped at 100</p></div></div><DataTable rows={data?.events} loading={loading} error={error} onRetry={() => { setLoading(true); setError(''); getEvents(apiKey).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); }} emptyText="The event stream has no records available." columns={[{ key: 'eventId', label: 'Event ID', render: (e) => <span className="mono clipped" title={e.eventId}>{e.eventId}</span> }, { key: 'eventType', label: 'Type', render: (e) => <span className="event-type">{e.eventType}</span> }, { key: 'rideId', label: 'Ride ID', render: (e) => <span className="mono">{e.rideId}</span> }, { key: 'status', label: 'Ride status', render: (e) => <StatusBadge status={e.status} /> }, { key: 'timestamp', label: 'Timestamp', render: (e) => e.timestamp ? new Date(e.timestamp).toLocaleString() : '—' }, { key: 'billing', label: 'Billing', render: (e) => <StatusBadge status={e.billing} /> }, { key: 'operations', label: 'Operations', render: (e) => <StatusBadge status={e.operations} /> }]} /></section>
  </div>;
}
