import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PoolStatus } from '../../shared/api';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: Error | string | null; retry?: () => void }) {
  if (!error) return null;
  return (
    <div className="alert error" role="alert">
      <span>{typeof error === 'string' ? error : error.message}</span>
      {retry && (
        <button type="button" className="btn small ghost" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function NotFound({ message = 'We couldn’t find that page.' }: { message?: string }) {
  return (
    <div className="empty-state">
      <div className="big-emoji" aria-hidden="true">🤷</div>
      <h2>Nothing here</h2>
      <p className="muted">{message}</p>
      <Link className="btn" to="/">
        Back home
      </Link>
    </div>
  );
}

export function CopyButton({ text, label = 'Copy', className = 'btn' }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy this:', text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? 'Copied!' : label}
    </button>
  );
}

/** Share via the native sheet on phones, fall back to copying. */
export function ShareButton({ url, title, text, label = 'Share' }: { url: string; title: string; text?: string; label?: string }) {
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  if (!canShare) return null;
  return (
    <button type="button" className="btn" onClick={() => navigator.share({ url, title, text }).catch(() => undefined)}>
      {label}
    </button>
  );
}

const STATUS: Record<PoolStatus, [string, string]> = {
  setup: ['Setting up', 'neutral'],
  open: ['Picks open', 'good'],
  locked: ['In progress', 'warn'],
  final: ['Final', 'done'],
};

export function StatusPill({ status }: { status: PoolStatus }) {
  const [label, tone] = STATUS[status];
  return <span className={`pill ${tone}`}>{label}</span>;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function relative(ms: number): string {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [86400_000, 'day'],
    [3600_000, 'hour'],
    [60_000, 'minute'],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [size, unit] of units) if (abs >= size) return rtf.format(Math.round(diff / size), unit);
  return rtf.format(Math.round(diff / 1000), 'second');
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Convert between epoch ms and the value of <input type="datetime-local">. */
export function toLocalInput(ms: number | null): string {
  if (ms === null) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
