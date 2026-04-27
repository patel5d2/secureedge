import { useEffect, useState, useCallback } from 'react';
import {
  Wifi,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  api,
  type HelpdeskDashboard as DashStats,
  type Alert,
  type AlertsResponse,
  type AccessEvent,
} from '../../lib/api';
import { formatTime, formatRelative } from '../../lib/format';
import { useRealtime } from '../../hooks/useRealtime';
import Button from '../../design-system/components/Button';
import Spinner from '../../design-system/components/Spinner';
import { useToast } from '../../hooks/useToast';

const sevConfig: Record<
  string,
  { label: string; fg: string; bg: string; dot: string }
> = {
  critical: { label: 'Critical', fg: '#FF8A73', bg: 'rgba(255,138,115,0.14)', dot: '#FF7555' },
  high: { label: 'High', fg: '#FFC36B', bg: 'rgba(255,195,107,0.14)', dot: '#FFB03D' },
  medium: { label: 'Medium', fg: '#8FD7FF', bg: 'rgba(143,215,255,0.14)', dot: '#6EC6FF' },
  low: { label: 'Low', fg: '#C9C4B8', bg: 'rgba(201,196,184,0.12)', dot: '#C9C4B8' },
};

/**
 * Helpdesk Dashboard — dark "ops room" mode. Dense, monospaced, signal-green accents.
 * A live denial/allow ticker on the left, a triage queue on the right, four giant counters up top.
 */
export default function HelpdeskDashboard() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [feed, setFeed] = useState<AccessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    Promise.all([
      api.get<DashStats>('/helpdesk/dashboard'),
      api.get<AlertsResponse>('/helpdesk/alerts'),
    ])
      .then(([s, a]) => {
        setStats(s);
        setAlerts(a.alerts.filter((x) => x.status === 'open').slice(0, 10));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const onEvent = useCallback((ev: AccessEvent) => {
    setFeed((prev) => [ev, ...prev].slice(0, 50));
  }, []);
  useRealtime<AccessEvent>('/events/stream', onEvent, true);

  const ack = async (id: string) => {
    try {
      await api.put(`/helpdesk/alerts/${id}`, { status: 'acknowledged' });
      setAlerts((a) =>
        a.map((x) => (x.id === id ? { ...x, status: 'acknowledged' as const } : x))
      );
      push('Alert acknowledged.', 'success');
    } catch {
      push('Failed to update alert.', 'error');
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  const statCards: Array<{
    label: string;
    value: number;
    icon: typeof Wifi;
    tone: 'signal' | 'warn' | 'danger';
  }> = [
    { label: 'Active connections', value: stats.activeConnections, icon: Wifi, tone: 'signal' },
    { label: 'Denials · 24h', value: stats.denials24h, icon: ShieldAlert, tone: 'danger' },
    { label: 'Open alerts', value: stats.openAlerts, icon: AlertTriangle, tone: 'warn' },
    { label: 'Critical', value: stats.criticalAlerts, icon: Activity, tone: 'danger' },
  ];

  const openAlerts = alerts.filter((a) => a.status === 'open');

  return (
    <div className="-m-10 min-h-[calc(100vh-3.5rem)] bg-[#0A0906] p-10 text-ink-0">
      {/* Ops header */}
      <header className="mb-8 flex items-baseline justify-between border-b border-white/10 pb-6">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-0/40">
            Helpdesk · live · us-east-1
          </p>
          <h1 className="mt-1 font-display text-[44px] leading-[1.05] tracking-[-0.02em] text-ink-0">
            Ops room
          </h1>
        </div>
        <span className="inline-flex items-center gap-2 font-mono text-[11px] text-ink-0/60">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-signal-500" />
            <span className="relative h-2 w-2 rounded-full bg-signal-500" />
          </span>
          STREAM ACTIVE
        </span>
      </header>

      {/* Stat counters */}
      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/10 xl:grid-cols-4">
        {statCards.map((s) => (
          <StatCounter key={s.label} {...s} />
        ))}
      </div>

      {/* Feed + Alerts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Live feed */}
        <section className="rounded-lg border border-white/10 bg-[#12100B] xl:col-span-3">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-0/40">
                Live event stream
              </p>
              <h2 className="mt-0.5 font-display text-[22px] leading-tight tracking-[-0.02em] text-ink-0">
                Everything, as it happens
              </h2>
            </div>
            <span className="font-mono text-[10px] text-ink-0/40">{feed.length} buffered</span>
          </div>
          <div className="max-h-[460px] overflow-y-auto divide-y divide-white/5">
            {feed.length === 0 ? (
              <p className="py-12 text-center font-mono text-[12px] text-ink-0/30">
                <span className="animate-pulse">▍</span> waiting for events…
              </p>
            ) : (
              feed.map((ev, i) => <EventRow key={ev.id || i} ev={ev} />)
            )}
          </div>
        </section>

        {/* Alerts */}
        <section className="flex flex-col rounded-lg border border-white/10 bg-[#12100B] xl:col-span-2">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-0/40">
                Triage queue
              </p>
              <h2 className="mt-0.5 font-display text-[22px] leading-tight tracking-[-0.02em] text-ink-0">
                Open alerts
              </h2>
            </div>
            <span className="font-mono text-[10px] text-ink-0/40">
              {openAlerts.length} open
            </span>
          </div>
          <div className="max-h-[460px] flex-1 overflow-y-auto divide-y divide-white/5">
            {openAlerts.length === 0 ? (
              <p className="py-12 text-center font-mono text-[12px] text-ink-0/30">
                No open alerts. All clear.
              </p>
            ) : (
              openAlerts.map((a) => {
                const sev = sevConfig[a.severity] || sevConfig.low;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-4">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.06em]"
                      style={{ background: sev.bg, color: sev.fg }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: sev.dot }}
                      />
                      {sev.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-0">
                        {a.type.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-ink-0/50">
                        {a.user_name || a.user_email || '—'} · {formatRelative(a.triggered_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-signal-300 hover:bg-white/5 hover:text-signal-200"
                      onClick={() => ack(a.id)}
                    >
                      Take <ArrowRight className="ml-1 h-3 w-3" strokeWidth={1.75} />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCounter({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Wifi;
  tone: 'signal' | 'warn' | 'danger';
}) {
  const toneColor = {
    signal: '#7FCD7A',
    warn: '#FFB03D',
    danger: '#FF7555',
  }[tone];
  return (
    <div className="relative bg-[#12100B] px-5 py-6">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: toneColor }} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-0/50">
          {label}
        </span>
      </div>
      <div className="mt-3 font-display text-[48px] leading-none tracking-[-0.02em] text-ink-0">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: AccessEvent }) {
  const allowed = ev.outcome === 'allow' || ev.outcome === 'allowed';
  const outcomeColor = allowed ? '#7FCD7A' : '#FF7555';
  return (
    <div className="flex items-center gap-3 px-5 py-3 font-mono text-[11px] animate-fade-in">
      <span
        className="flex-shrink-0 rounded-sm px-1.5 py-[2px] text-[9px] font-semibold uppercase tracking-[0.06em]"
        style={{
          background: allowed ? 'rgba(127,205,122,0.14)' : 'rgba(255,117,85,0.14)',
          color: outcomeColor,
        }}
      >
        {allowed ? 'ALLOW' : 'DENY'}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink-0/90">
        {ev.user_name || ev.user_email || '—'}
        <span className="mx-2 text-ink-0/30">→</span>
        <span className="text-ink-0/60">{ev.app_name || '—'}</span>
      </span>
      <span className="hidden flex-shrink-0 text-ink-0/40 lg:inline">
        {ev.ip_address || '—'}
      </span>
      {ev.geo_country && (
        <span className="hidden flex-shrink-0 text-ink-0/40 lg:inline">{ev.geo_country}</span>
      )}
      <span className="flex flex-shrink-0 items-center gap-1 text-ink-0/40">
        <Clock className="h-3 w-3" strokeWidth={1.75} />
        {formatTime(ev.timestamp)}
      </span>
    </div>
  );
}
