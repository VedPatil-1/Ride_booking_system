import { useEffect, useState } from 'react';
import { Activity, Clock3, Database, Radio, Server, ShieldCheck, Wifi } from 'lucide-react';
import { getHealth } from '../api/adminApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { ErrorState, LoadingState } from '../components/States.jsx';

const services = [
  { key: 'api', label: 'Backend API', icon: Server, detail: 'Responded to authenticated dashboard request' },
  { key: 'mongodb', label: 'MongoDB', icon: Database, detail: 'Connection state from backend' },
  { key: 'redis', label: 'Redis', icon: Wifi, detail: 'Connection and ping from backend' },
  { key: 'assignmentWorker', label: 'Assignment worker', icon: Activity, detail: 'Redis heartbeat · 30 second expiry' },
  { key: 'billingSubscriber', label: 'Billing subscriber', icon: Radio, detail: 'Redis heartbeat · 30 second expiry' },
  { key: 'operationsSubscriber', label: 'Operations subscriber', icon: ShieldCheck, detail: 'Redis heartbeat · 30 second expiry' },
];

export default function Health({ apiKey }) {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); setError(''); try { setData(await getHealth(apiKey)); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [apiKey]);
  if (loading && !data) return <LoadingState label="Checking service health…" />;
  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  return <div className="page-content"><div className="section-intro"><div><h2>Service health</h2><p>Connectivity checks and process-liveness signals from the backend.</p></div><span className="updated-label">Checked {new Date(data.dataAsOf).toLocaleTimeString()}</span></div>{error && <div className="inline-warning">{error} Showing last successful check.</div>}
    <div className="health-grid">{services.map(({ key, label, icon: Icon, detail }) => { const service = data.services[key]; return <article className="panel health-card" key={key}><div className="health-card-top"><div className="health-icon"><Icon size={19} /></div><StatusBadge status={service.status} /></div><h3>{label}</h3><p>{detail}</p>{service.heartbeatAgeSeconds != null && <div className="heartbeat-age"><Clock3 size={13} />Heartbeat {service.heartbeatAgeSeconds}s ago</div>}</article>; })}</div>
    <div className="callout health-note"><Clock3 size={18} /><span><b>How to read this page:</b> A fresh heartbeat means the worker or subscriber process is alive. It does not guarantee a recent successful job or event. “Unavailable” means no fresh heartbeat was observed; it is not a synthetic estimate.</span></div>
  </div>;
}
