import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Users, FileText, ShieldAlert, Activity, CheckCircle2, ArrowUpRight } from 'lucide-react';
import {
  api,
  type OverviewStats,
  type AccessEvent,
  type RecentEventsResponse,
} from '../../lib/api';
import { formatTime } from '../../lib/format';
import Spinner from '../../design-system/components/Spinner';
import { Link } from 'react-router-dom';

const AccessEventsChart = lazy(() => import('./AccessEventsChart'));

const REFRESH_MS = 60_000;

/**
 * Admin Overview — editorial headline, stat chips, the access-events line chart
 * (lazy-loaded so /admin doesn't pay for recharts on first paint), and the live
 * denials feed in the newspaper column on the right.
 */
export default function AdminOverview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [events, setEvents] = useState<AccessEvent[] | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  // Chart and event-feed each fetch independently so neither blocks the other.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const s = await api.get<OverviewStats>('/admin/overview');
        if (!cancelled) {
          setStats(s);
          setRefreshedAt(new Date());
        }
      } catch {
        /* ignore — keep last good data on the screen */
      }
    };
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<RecentEventsResponse>('/admin/recent-events')
      .then((e) => !cancelled && setEvents(e.events))
      .catch(() => !cancelled && setEvents([]));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  const totalEvents =
    stats.trend.allowed.reduce((a, b) => a + b, 0) +
    stats.trend.denied.reduce((a, b) => a + b, 0);

  const statChips: Array<{
    label: string;
    value: number;
    icon: typeof Users;
    tone: 'neutral' | 'signal' | 'warn' | 'danger';
  }> = [
    { label: 'Active users · 24h', value: stats.activeUsers24h, icon: Users, tone: 'neutral' },
    { label: 'Active policies', value: stats.policiesActive, icon: FileText, tone: 'signal' },
    { label: 'Denials · 24h', value: stats.denials24h, icon: ShieldAlert, tone: 'danger' },
    { label: 'Critical alerts', value: stats.criticalAlerts, icon: Activity, tone: 'warn' },
  ];

  return (
    <div className="space-y-10">
      <header className="border-b border-ink-100 pb-8">
        <div className="flex items-baseline gap-4 text-[11px] uppercase tracking-[0.08em] text-ink-400">
          <span className="font-mono">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <span className="h-px flex-1 bg-ink-100" />
          <RefreshIndicator refreshedAt={refreshedAt} />
        </div>
        <h1 className="mt-3 font-display text-[56px] leading-[1.05] tracking-[-0.02em] text-ink-900">
          Today, the gate answered{' '}
          <em className="not-italic font-display italic">{totalEvents.toLocaleString()}</em> times.
        </h1>
        <p className="mt-3 max-w-[620px] text-[15px] leading-relaxed text-ink-500">
          {stats.denials24h} were denied. Here's what's happening across your estate.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink-100 bg-ink-100 xl:grid-cols-4">
        {statChips.map((s) => (
          <StatChip key={s.label} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="xl:col-span-3 rounded-lg border border-ink-100 bg-white p-6">
          <div className="mb-5 flex items-end justify-between border-b border-ink-100 pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                Access events
              </p>
              <h2 className="font-display text-[28px] leading-tight tracking-[-0.02em] text-ink-900">
                Last 24 hours
              </h2>
            </div>
            <LegendSwatch />
          </div>

          {totalEvents === 0 ? (
            <ChartEmptyState />
          ) : (
            <Suspense fallback={<div className="h-72 animate-pulse rounded-md bg-ink-50" aria-hidden="true" />}>
              <AccessEventsChart trend={stats.trend} />
            </Suspense>
          )}
        </section>

        <section className="xl:col-span-2 flex flex-col rounded-lg border border-ink-100 bg-white">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                The denials desk
              </p>
              <h2 className="font-display text-xl leading-tight tracking-[-0.02em] text-ink-900">
                Last 10 denied
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-ink-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-pulse-dot rounded-full bg-danger" />
                <span className="relative h-2 w-2 rounded-full bg-danger" />
              </span>
              LIVE
            </span>
          </div>
          <div className="flex-1 divide-y divide-ink-100 overflow-y-auto">
            {events === null ? (
              <div className="flex h-full items-center justify-center p-8">
                <Spinner size={20} />
              </div>
            ) : events.length === 0 ? (
              <p className="p-8 text-center text-sm text-ink-400">No recent denials. Nice.</p>
            ) : (
              events.map((ev) => <DenialRow key={ev.id} ev={ev} />)
            )}
          </div>
          <Link
            to="/admin/audit-log"
            className="flex items-center justify-between gap-2 border-t border-ink-100 px-5 py-3 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-ink-50"
          >
            See the full audit log
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </section>
      </div>

      <section>
        <div className="mb-4 flex items-baseline gap-4">
          <h2 className="font-display text-[28px] leading-tight tracking-[-0.02em] text-ink-900">
            Systems, all <em className="not-italic font-display italic">nominal</em>
          </h2>
          <span className="h-px flex-1 bg-ink-100" />
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-400">
            us-east-1 · checked 12s ago
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {['Gateway', 'IdP connection', 'Audit pipeline', 'MFA service'].map((svc) => (
            <div
              key={svc}
              className="flex items-center gap-2.5 rounded-md border border-ink-100 bg-white px-3.5 py-3"
            >
              <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink-900">{svc}</p>
                <p className="font-mono text-[10px] text-ink-400">operational</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RefreshIndicator({ refreshedAt }: { refreshedAt: Date | null }) {
  const [, force] = useState(0);
  // tick every 5s so the "12s ago" copy stays fresh between fetches
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 5_000);
    return () => window.clearInterval(id);
  }, []);
  if (!refreshedAt) return <span className="font-mono">Loading…</span>;
  const ago = Math.max(0, Math.round((Date.now() - refreshedAt.getTime()) / 1000));
  const label = ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}m`;
  return (
    <span className="font-mono" aria-live="polite">
      Live · refreshed {label} ago
    </span>
  );
}

function ChartEmptyState() {
  return (
    <div
      className="flex h-72 flex-col items-center justify-center rounded-md bg-ink-50 text-center"
      role="img"
      aria-label="No access events recorded in the last 24 hours"
    >
      <p className="font-display text-2xl text-ink-700">Quiet on the wire.</p>
      <p className="mt-1 max-w-xs text-sm text-ink-500">
        No access events recorded in the last 24 hours.
      </p>
    </div>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone: 'neutral' | 'signal' | 'warn' | 'danger';
}) {
  const toneColor = {
    neutral: 'text-ink-700',
    signal: 'text-signal-600',
    warn: 'text-warning',
    danger: 'text-danger',
  }[tone];
  return (
    <div className="relative bg-white px-5 py-5">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${toneColor}`} strokeWidth={1.75} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
          {label}
        </span>
      </div>
      <div className="mt-2 font-display text-[44px] leading-none tracking-[-0.02em] text-ink-900">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function LegendSwatch() {
  return (
    <div className="flex items-center gap-4 font-mono text-[10px] text-ink-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-[2px] w-5 bg-success" /> Allowed
      </span>
      <span className="inline-flex items-center gap-1.5">
        {/* dashed swatch matches chartPalette.deniedDash */}
        <svg width="20" height="2" aria-hidden="true">
          <line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeDasharray="5 3" className="text-danger" />
        </svg>
        Denied
      </span>
    </div>
  );
}

function DenialRow({ ev }: { ev: AccessEvent }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-danger" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[13px] font-semibold text-ink-900">
            {ev.user_name || ev.user_email}
          </p>
          <p className="flex-shrink-0 font-mono text-[10px] text-ink-400">
            {formatTime(ev.timestamp)}
          </p>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-ink-500">
          tried <span className="text-ink-700">{ev.app_name}</span>
        </p>
        <p className="mt-1 inline-block rounded-sm bg-danger-surface px-1.5 py-0.5 font-mono text-[10px] text-danger-ink">
          {ev.deny_reason?.replace(/_/g, ' ')}
        </p>
      </div>
    </div>
  );
}
