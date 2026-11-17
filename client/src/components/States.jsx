import { AlertCircle, LoaderCircle, SearchX } from 'lucide-react';

export function LoadingState({ label = 'Loading live data…' }) {
  return <div className="state-panel"><LoaderCircle className="spin" size={21} /><span>{label}</span></div>;
}

export function ErrorState({ message, onRetry }) {
  return <div className="state-panel state-error"><AlertCircle size={21} /><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}</div>;
}

export function EmptyState({ message = 'No matching records found.' }) {
  return <div className="state-panel"><SearchX size={21} /><span>{message}</span></div>;
}
