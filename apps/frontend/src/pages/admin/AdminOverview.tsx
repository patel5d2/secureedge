import { useEffect, useState } from 'react';
import { Users, FileText, ShieldAlert, Activity, CheckCircle2, ArrowUpRight } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  api,
  type OverviewStats,
  type AccessEvent,
  type RecentEventsResponse,
} from '../../lib/api';
import { formatTime } from '../../lib/format';
import Spinner from '../../design-system/components/Spinner';
import { colors } from '../../design-system/tokens';
import { Link } from 'react-router-dom';

/**
 * Admin Overview — editorial headline, single hero number, a thin row of stat chips,
 * a serif-labeled chart, and a live denials feed in the newspaper column on the right.
 */
export default function AdminOverview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<OverviewStats>('/admin/overview'),
      api.get<RecentEventsResponse>('/admin/recent-events'),
    ])
      .then(([s, e]) => {
        setStats(s);
        setEvents(e.events);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  const chartData = stats.trend.labels.map((l, i) => ({
    time: l.slice(11, 16),
    Allowed: stats.trend.allowed[i],
    Denied: stats.trend.denied[i],
  }));

  const totalEvents = stats.trend.allowed.reduce((a, b) => a + b, 0) +
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
      {/* Editorial header */}
      <header className="border-b border-ink-100 pb-8">
        <div className="flex items-baseline gap-4 text-[11px] uppercase tracking-[0.08em] text-ink-400">
          <span className="font-mono">{new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}</span>
          <span className="h-px flex-1 bg-ink-100" />
          <span className="font-mono">Live · auto-refresh 60s</span>
        </div>
        <h1 className="mt-3 font-display text-[56px] leading-[1.05] tracking-[-0.02em] text-ink-900">
          Today, the gate answered{' '}
          <em className="not-italic font-display italic">{totalEvents.toLocaleString()}</em> times.
        </h1>
        <p className="mt-3 max-w-[620px] text-[15px] leading-relaxed text-ink-500">
          {stats.denials24h} were denied. Here's what's happening across your estate.
        </p>
      </header>

      {/* Stat chips */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink-100 bg-ink-100 xl:grid-cols-4">
        {statChips.map((s) => (
          <StatChip key={s.label} {...s} />
        ))}
      </div>

      {/* Chart + events */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Chart */}
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
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={colors.border} vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: colors.textMuted, fontFamily: 'Geist Mono' }}
                  axisLine={{ stroke: colors.border }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: colors.textMuted, fontFamily: 'Geist Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    boxShadow: '0 8px 24px -8px rgba(14,13,10,0.12)',
                  }}
                  labelStyle={{ fontFamily: 'Geist Mono', color: colors.textMuted }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, fontFamily: 'Geist Mono', display: 'none' }}
                />
                <Line
                  type="monotone"
                  dataKey="Allowed"
                  stroke={colors.success}
                  strokeWidth={1.75}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Denied"
                  stroke={colors.danger}
                  strokeWidth={1.75}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Live feed */}
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
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[#D1432B]" />
                <span className="relative h-2 w-2 rounded-full bg-[#D1432B]" />
              </span>
              LIVE
            </span>
          </div>
          <div className="flex-1 divide-y divide-ink-100 overflow-y-auto">
            {events.length === 0 ? (
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

      {/* System health */}
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
              <CheckCircle2 className="h-4 w-4 text-[#3CB13A]" strokeWidth={1.75} />
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
    warn: 'text-[#D89422]',
    danger: 'text-[#D1432B]',
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
        <span className="h-[2px] w-5 bg-[#3CB13A]" /> Allowed
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-[2px] w-5 bg-[#D1432B]" /> Denied
      </span>
    </div>
  );
}

function DenialRow({ ev }: { ev: AccessEvent }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#D1432B]" />
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
        <p className="mt-1 inline-block rounded-sm bg-[#FBEAE7] px-1.5 py-0.5 font-mono text-[10px] text-[#8B2613]">
          {ev.deny_reason?.replace(/_/g, ' ')}
        </p>
      </div>
    </div>
  );
}
