import { Activity, CarFront, Gauge, Radio, ShieldCheck, UsersRound, X, KeyRound } from 'lucide-react';

const items = [
  { id: 'Overview', icon: Gauge }, { id: 'Live rides', icon: CarFront },
  { id: 'Drivers', icon: UsersRound }, { id: 'Event monitoring', icon: Radio },
  { id: 'System health', icon: ShieldCheck },
];

export default function Sidebar({ page, setPage, open, close }) {
  return <>
    {open && <button aria-label="Close menu" className="mobile-scrim" onClick={close} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Activity size={19} /></div><div><b>ride<span>ops</span></b><small>OPERATIONS CENTER</small></div><button className="mobile-close" onClick={close}><X size={18} /></button></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav>{items.map(({ id, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => { setPage(id); close(); }}><Icon size={18} /><span>{id}</span>{page === id && <i />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-status"><KeyRound size={15} color="#94a8ff" /><div><b>Admin session</b><small>Key held in memory</small></div></div><div className="sidebar-foot">RIDE BOOKING SYSTEM <span>v1.0</span></div></div>
    </aside>
  </>;
}
