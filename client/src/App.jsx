import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowRight, KeyRound, LockKeyhole } from 'lucide-react';
import { adminRequest } from './api/adminApi.js';
import Sidebar from './components/Sidebar.jsx';
import PageHeader from './components/PageHeader.jsx';
import { LoadingState } from './components/States.jsx';

const Overview = lazy(() => import('./pages/Overview.jsx'));
const LiveRides = lazy(() => import('./pages/LiveRides.jsx'));
const Drivers = lazy(() => import('./pages/Drivers.jsx'));
const Events = lazy(() => import('./pages/Events.jsx'));
const Health = lazy(() => import('./pages/Health.jsx'));

function Login({ onLogin }) {
  const [key, setKey] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setLoading(true);
    try { await adminRequest('/health', key); onLogin(key); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  return <main className="login-shell"><div className="login-decoration"><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /><div className="login-decoration-copy"><div className="brand-mark"><KeyRound size={20} /></div><div className="eyebrow">RIDE OPERATIONS</div><h1>Clarity for every<br />mile.</h1><p>A calm, real-time view of the rides and services powering your operation.</p><div className="login-decoration-foot"><span className="live-dot" /> PRIVATE OPERATIONS CONSOLE</div></div></div><div className="login-form-side"><form className="login-form" onSubmit={submit}><div className="login-small-mark"><KeyRound size={18} /></div><span className="eyebrow">ADMIN ACCESS</span><h2>Welcome back</h2><p>Enter your admin API key to access the operations dashboard.</p><label htmlFor="admin-key">Admin API key</label><div className="key-input"><LockKeyhole size={17} /><input id="admin-key" type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Enter your key" required /></div>{error && <div className="login-error">{error}</div>}<button className="login-submit" disabled={loading || !key}>{loading ? 'Verifying…' : 'Continue'}{!loading && <ArrowRight size={17} />}</button><div className="login-security"><LockKeyhole size={14} /><span>Key is held in memory for this tab and sent only to the backend over your configured API connection. It is not saved in browser storage.</span></div></form><div className="login-copyright">RIDE BOOKING SYSTEM <span>·</span> ADMIN DASHBOARD</div></div></main>;
}

const pageComponents = { Overview, 'Live rides': LiveRides, Drivers, 'Event monitoring': Events, 'System health': Health };

export default function App() {
  const [apiKey, setApiKey] = useState(''); const [page, setPage] = useState('Overview'); const [menuOpen, setMenuOpen] = useState(false); const [revision, setRevision] = useState(0);
  useEffect(() => { if (!apiKey) return undefined; const timer = setInterval(() => setRevision((n) => n + 1), 30_000); return () => clearInterval(timer); }, [apiKey]);
  if (!apiKey) return <Login onLogin={setApiKey} />;
  const Page = pageComponents[page];
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} open={menuOpen} close={() => setMenuOpen(false)} /><main className="main-area"><PageHeader page={page} onRefresh={() => setRevision((n) => n + 1)} onMenu={() => setMenuOpen(true)} /><div key={`${page}-${revision}`} className="content-wrap"><Suspense fallback={<LoadingState label="Loading dashboard view…" />}><Page apiKey={apiKey} /></Suspense></div></main></div>;
}
