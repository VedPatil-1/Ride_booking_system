import { useEffect, useState } from 'react';
import { CarFront, CircleCheck, UsersRound } from 'lucide-react';
import { getDrivers } from '../api/adminApi.js';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Drivers({ apiKey }) {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; getDrivers(apiKey).then((d) => active && setData(d)).catch((e) => active && setError(e.message)).finally(() => active && setLoading(false)); return () => { active = false; }; }, [apiKey]);
  const drivers = data?.drivers || [];
  return <div className="page-content"><div className="section-intro"><div><h2>Driver roster</h2><p>Existing fake driver IDs with status derived from ride records.</p></div><span className="result-count">{drivers.length} configured</span></div>
    <div className="callout"><CircleCheck size={18} /><span><b>Derived status</b> — this backend has no driver registry, availability feed, or ride completion state. A driver without an assigned ride record is labeled “No assignment record”; that does not confirm the driver is available.</span></div>
    <div className="driver-summary"><article className="panel driver-total"><div className="driver-summary-icon"><UsersRound /></div><div><small>Total configured</small><b>{loading ? '—' : drivers.length}</b></div></article><article className="panel driver-total"><div className="driver-summary-icon available-icon"><CircleCheck /></div><div><small>No assignment record</small><b>{loading ? '—' : drivers.filter((d) => d.assignmentRecordStatus === 'NO_ASSIGNED_RIDE_RECORD').length}</b></div></article><article className="panel driver-total"><div className="driver-summary-icon assigned-icon"><CarFront /></div><div><small>Has assigned ride record</small><b>{loading ? '—' : drivers.filter((d) => d.assignmentRecordStatus === 'HAS_ASSIGNED_RIDE_RECORD').length}</b></div></article></div>
    <section className="panel"><div className="panel-heading"><div><h3>Configured drivers</h3><p>Fake IDs from the existing assignment service</p></div></div><DataTable rows={data?.drivers} loading={loading} error={error} onRetry={() => { setLoading(true); setError(''); getDrivers(apiKey).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); }} columns={[{ key: 'driverId', label: 'Driver ID', render: (d) => <span className="driver-id"><span className="avatar">{d.driverId.slice(-2)}</span><b className="mono">{d.driverId}</b></span> }, { key: 'assignmentRecordStatus', label: 'Derived record status', render: (d) => <StatusBadge status={d.assignmentRecordStatus} /> }, { key: 'assignedRideId', label: 'Assigned ride record', render: (d) => d.assignedRideId ? <span className="mono">{d.assignedRideId}</span> : <span className="muted">—</span> }]} /></section>
  </div>;
}
