import { Menu, RefreshCw } from 'lucide-react';

export default function PageHeader({ page, onRefresh, onMenu }) {
  const subtitles = {
    Overview: 'A live view of ride operations and system performance.',
    'Live rides': 'Search and review the latest ride activity.',
    Drivers: 'Availability is derived from currently assigned ride records.',
    'Event monitoring': 'Stream delivery and consumer processing status.',
    'System health': 'Process liveness and service connectivity.',
  };
  return <header className="page-header"><button className="icon-button menu-button" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button><div><div className="eyebrow">OPERATIONS / {page.toUpperCase()}</div><h1>{page}</h1><p>{subtitles[page]}</p></div><button className="refresh-button" onClick={onRefresh}><RefreshCw size={15} /><span>Refresh</span></button></header>;
}
